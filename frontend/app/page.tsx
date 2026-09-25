"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { IncidentResult } from "@/lib/schema";
import { redact, MAX_INPUT } from "@/lib/evidence";
import { incidentBrief } from "@/lib/brief";

function Citations({ ids }: { ids: string[] }) {
  return (
    <span className="citations">
      {ids.map((id) => (
        <a key={id} href={`#${id}`} aria-label={`View evidence ${id}`}>
          {id}
        </a>
      ))}
    </span>
  );
}

export default function Home() {
  const [incident, setIncident] = useState("");
  const [result, setResult] = useState<IncidentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingFixture, setLoadingFixture] = useState(false);
  const [exportContent, setExportContent] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Checking backend…");
  const [synthetic, setSynthetic] = useState(false);
  const [previewCounts, setPreviewCounts] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setStatus(data.status || "Backend status unavailable"))
      .catch(() => {
        if (!controller.signal.aborted) setStatus("Backend status unavailable");
      });
    return () => controller.abort();
  }, []);

  function changeInput(raw: string, showSynthetic = false) {
    setExportContent("");
    const clean = redact(raw);
    setIncident(showSynthetic ? raw : clean.text);
    setPreviewCounts(clean.counts);
    setSynthetic(showSynthetic);
    setResult(null);
    setError("");
  }
  async function loadFixture(name: string) {
    setLoadingFixture(true);
    setExportContent("");
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(`/api/fixtures/${name}`);
      if (!response.ok) throw new Error("Unable to load fixture.");
      const data = await response.json();
      changeInput(data.incident, name === "redaction-test");
    } catch {
      setError("Unable to load fixture. Check the local server.");
    } finally {
      setLoadingFixture(false);
      setBusy(false);
    }
  }
  async function analyze() {
    setExportContent("");
    if (!incident.trim()) {
      setError("Load a fixture or paste evidence first.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incident }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!data.state)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "No valid server response.",
        );
      setResult(data);
      if (data.backend.kind === "bedrock")
        setStatus(
          data.analysis
            ? "Bedrock response verified · this run"
            : "Bedrock · no validated response this run",
        );
      if (data.error) setError(data.error.message);
      setIncident(redact(incident).text);
      setSynthetic(false);
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "AbortError"
          ? e.message
          : "Request timed out. No analysis was accepted.",
      );
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }
  function download(format: "md" | "json") {
    if (!result) return;
    const content =
      format === "md" ? incidentBrief(result) : JSON.stringify(result, null, 2);
    setExportContent(content);
    const url = URL.createObjectURL(
      new Blob([content], {
        type: format === "md" ? "text/markdown" : "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `resq-incident.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const a = result?.analysis;
  const redactions = Object.values(result?.redactionCounts ?? {}).reduce(
    (x, y) => x + y,
    0,
  );
  const previewRedactions = Object.values(previewCounts).reduce(
    (x, y) => x + y,
    0,
  );

  return (
    <main>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="ResQ home">
          <span className="mark">RQ</span>
          <span>
            ResQ<span className="brand-sub">INCIDENT INTELLIGENCE</span>
          </span>
        </Link>
        <span className="status" role="status">
          <span className="status-dot" />
          {status}
        </span>
      </header>
      <section className="intro">
        <p className="eyebrow">EVIDENCE FIRST. HUMAN REVIEW ALWAYS.</p>
        <h1>
          From scattered logs
          <br />
          to a <em>defensible next step.</em>
        </h1>
        <p>
          Reconstruct the timeline. Inspect every citation. Know when the cause
          is still unconfirmed.
        </p>
        <div className="intro-meta">
          <span>01 / Load evidence</span>
          <span>02 / Verify the hypothesis</span>
          <span>03 / Export the brief</span>
        </div>
      </section>
      <div className="workspace">
        <section className="panel input-panel" aria-labelledby="evidence-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">INPUT / 01</p>
              <h2 id="evidence-title">Incident evidence</h2>
            </div>
            <span className="tag">Max 200 lines</span>
          </div>
          <p className="muted">
            Start with a synthetic bundle, upload a text log, or paste your own.
          </p>
          <div className="fixture-buttons">
            <button
              disabled={busy}
              onClick={() => loadFixture("well-evidenced")}
            >
              Payment outage
            </button>
            <button disabled={busy} onClick={() => loadFixture("ambiguous")}>
              Ambiguous incident
            </button>
            <button
              disabled={busy}
              onClick={() => loadFixture("redaction-test")}
            >
              Redaction test
            </button>
          </div>
          <label className="upload">
            Load .txt or .log file
            <input
              type="file"
              accept=".txt,.log,text/plain"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > MAX_INPUT) {
                  setError("Upload a file smaller than 64 KB.");
                  return;
                }
                try {
                  changeInput(await file.text());
                } catch {
                  setError("Unable to read that file.");
                }
                e.target.value = "";
              }}
            />
          </label>
          {synthetic && (
            <p className="notice">
              Synthetic redaction test only. These example tokens are fake;
              analysis will remove them.
            </p>
          )}
          <label className="input-label" htmlFor="incident">
            Evidence lines
          </label>
          <textarea
            id="incident"
            disabled={busy}
            spellCheck={false}
            maxLength={MAX_INPUT}
            value={incident}
            onChange={(e) => changeInput(e.target.value)}
            placeholder="2026-09-19T02:12:03Z ERROR service=payment-api error=ConnectionPoolTimeout"
          />
          <div className="input-meta">
            <span>{incident.length.toLocaleString()} / 64,000 characters</span>
            <span>{previewRedactions} preview replacements</span>
          </div>
          <p className="privacy-note">
            Known secret and personal-data patterns are redacted on paste and
            again on the server. Review the preview: this is not comprehensive
            PII detection.
          </p>
          <button
            className="primary"
            disabled={busy || !incident.trim()}
            onClick={analyze}
          >
            {busy ? "Processing evidence…" : "Analyze incident"}
            <span aria-hidden="true">↗</span>
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section
          className="panel analysis-panel"
          aria-labelledby="analysis-title"
          aria-busy={busy}
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">REVIEW / 02</p>
              <h2 id="analysis-title">Incident assessment</h2>
            </div>
            {a && (
              <span className={`severity ${a.severity}`}>{a.severity}</span>
            )}
          </div>
          <div aria-live="polite">
            {busy ? (
              <div className="empty">
                <div className="orb pulse">◎</div>
                <h3>{loadingFixture ? "Loading the fixture" : "Processing the evidence"}</h3>
                <p>
                  {loadingFixture ? "Fetching a synthetic incident bundle from the local server." : "Redaction, timeline construction, inference and validation. The completed trace will appear below."}
                </p>
              </div>
            ) : !result ? (
              <div className="empty">
                <div className="orb">◎</div>
                <h3>Evidence before conclusions.</h3>
                <p>
                  Load the payment outage to inspect a supported failure
                  mechanism. Try the ambiguous incident to see why ResQ
                  withholds a cause.
                </p>
                <span className="tag">No analysis has run</span>
              </div>
            ) : (
              <>
                <p
                  className={`run-state ${result.state === "FAILED" ? "failed" : ""}`}
                >
                  {result.state.replaceAll("_", " ")}
                </p>
                <p className="backend-identity">
                  {result.backend.kind === "demo"
                    ? "DETERMINISTIC DEMO · No AWS calls"
                    : "AMAZON BEDROCK"}
                  <br />
                  <code>{result.backend.model}</code>
                </p>
                {a ? (
                  <>
                    <div className="hypothesis">
                      <p className="eyebrow">
                        {a.rootCause.code === "unconfirmed"
                          ? "CAUSE UNCONFIRMED"
                          : "SUPPORTED FAILURE MECHANISM"}
                      </p>
                      <h3>{a.rootCause.statement}</h3>
                      <Citations ids={a.rootCause.evidenceIds} />
                      <p className="confidence">
                        {a.confidence.level} confidence · qualitative support
                      </p>
                      <p className="muted">{a.confidence.qualification}</p>
                    </div>
                    <h3 className="subheading">
                      Observed facts <span>verbatim evidence</span>
                    </h3>
                    <ul className="facts">
                      {a.observedFacts.map((fact, i) => (
                        <li key={i}>
                          <Citations ids={fact.evidenceIds} />
                          <code>{fact.statement}</code>
                        </li>
                      ))}
                    </ul>
                    <details open>
                      <summary>Alternative hypotheses · unverified</summary>
                      {a.alternativeHypotheses.map((h, i) => (
                        <div className="alternative" key={i}>
                          <p>{h.hypothesis}</p>
                          <Citations ids={h.evidenceIds} />
                          <p className="muted">Next check: {h.nextCheck}</p>
                        </div>
                      ))}
                    </details>
                    <h3 className="subheading">Recommended next checks</h3>
                    <ol>
                      {a.recommendedNextChecks.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ol>
                    <h3 className="subheading">Suggested mitigations</h3>
                    <ul>
                      {a.suggestedMitigations.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                    <p className="notice">
                      Human approval required. ResQ does not execute
                      remediation.
                    </p>
                    <details>
                      <summary>Limitations &amp; evidence policy</summary>
                      <ul>
                        {a.limitations.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                      <p>
                        Severity reflects structured log levels, not
                        independently measured business impact.
                      </p>
                    </details>
                  </>
                ) : (
                  <div className="notice">
                    <h3>
                      {result.state === "FAILED"
                        ? "No answer accepted"
                        : "Cause unconfirmed"}
                    </h3>
                    <p>
                      {result.error?.message ??
                        "Add time-correlated service metrics and error logs to continue."}
                    </p>
                  </div>
                )}
                {result.warnings.map((w) => (
                  <p className="notice" key={w}>
                    {w}
                  </p>
                ))}
              </>
            )}
          </div>
        </section>
      </div>
      {result && (
        <section
          className="panel timeline-panel"
          aria-labelledby="timeline-title"
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TRACE / 03</p>
              <h2 id="timeline-title">Evidence timeline</h2>
              <p className="muted">
                {result.evidence.length} lines · {redactions} server
                replacements · IDs map to original line numbers within this
                bundle
              </p>
            </div>
            <div className="export">
              <button onClick={() => download("md")}>Export brief .md</button>
              <button onClick={() => download("json")}>
                Export trace .json
              </button>
            </div>
          </div>
          {exportContent && <div className="export-preview"><label className="input-label" htmlFor="export-content">Export content — copy this if your browser blocks the download</label><textarea id="export-content" readOnly value={exportContent} /></div>}
          <ol className="trace">
            {result.trace.map((step) => (
              <li key={step.state}>
                <strong>{step.state}</strong>
                <time>{step.at}</time>
              </li>
            ))}
          </ol>
          <div className="timeline">
            {result.evidence.map((e) => (
              <article id={e.id} key={e.id} tabIndex={-1}>
                <div>
                  <a href={`#${e.id}`} className="evidence-id">
                    {e.id}
                  </a>
                  <span>Original line {e.lineNumber}</span>
                  <time>{e.timestamp ?? "Timestamp unavailable"}</time>
                </div>
                <pre>{e.text}</pre>
              </article>
            ))}
          </div>
        </section>
      )}
      <footer>
        <span>ResQ / Evidence-first AI incident analyst</span>
        <span>Redact → reconstruct → analyze → verify → review</span>
      </footer>
    </main>
  );
}
