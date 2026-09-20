"use client";

import { useState } from "react";

type AnalysisResult = {
  severity: string;
  summary: string;
  root_cause: string;
  confidence: number;
  recommended_actions: string[];
};

const demoIncident = `2026-09-19T02:02:14Z DEPLOY service=payment-api version=2.8.1 status=success
2026-09-19T02:08:12Z WARN service=payment-api db_connections=86 max_connections=100
2026-09-19T02:10:55Z WARN service=payment-api db_connections=94 max_connections=100
2026-09-19T02:12:03Z ERROR service=payment-api error=ConnectionPoolTimeout timeout_seconds=30
2026-09-19T02:12:18Z ERROR service=payment-api error=ConnectionPoolTimeout timeout_seconds=30
2026-09-19T02:13:01Z ERROR service=payment-api event=payment_failed user=john@example.com
2026-09-19T02:13:14Z CRITICAL service=payment-api error_rate=37 Authorization: Bearer super-secret-token`;

export default function Home() {
  const [incident, setIncident] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyzeIncident() {
    if (!incident.trim()) {
      setError("Enter incident evidence before starting analysis.");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      setError("NEXT_PUBLIC_API_URL is not configured.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          incident,
        }),
      });

      if (!response.ok) {
        throw new Error(`AWS Lambda returned HTTP ${response.status}`);
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to analyze the incident."
      );
    } finally {
      setLoading(false);
    }
  }

  function loadDemo() {
    setIncident(demoIncident);
    setResult(null);
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#070b12] text-slate-100">
      <header className="border-b border-slate-800 bg-[#0b111b]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 font-bold text-slate-950">
                RQ
              </div>

              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  ResQ
                </h1>
                <p className="text-xs text-slate-400">
                  Evidence-First AI Incident Commander
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            AWS Backend Online
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
            Incident Command Center
          </p>

          <h2 className="max-w-3xl text-4xl font-semibold tracking-tight">
            Understand incidents.
            <span className="text-slate-500"> Act with evidence.</span>
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
            Submit production evidence for AI-assisted incident analysis.
            ResQ sends the evidence to the AWS incident-analysis pipeline and
            returns structured severity, root-cause analysis, confidence, and
            recommended response actions.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-2xl border border-slate-800 bg-[#0b111b] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Incident Evidence</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Logs, alerts, deployment events, and observed symptoms
                </p>
              </div>

              <button
                onClick={loadDemo}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-cyan-500 hover:text-cyan-300"
              >
                Load demo incident
              </button>
            </div>

            <textarea
              value={incident}
              onChange={(event) => setIncident(event.target.value)}
              placeholder="Paste production incident evidence here..."
              className="min-h-[390px] w-full resize-none rounded-xl border border-slate-800 bg-[#060a10] p-4 font-mono text-sm leading-6 text-slate-300 outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
            />

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              onClick={analyzeIncident}
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center rounded-xl bg-cyan-400 px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Analyzing with Amazon Bedrock..." : "Analyze Incident"}
            </button>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span className="rounded-md bg-slate-900 px-2 py-1">
                AWS Lambda
              </span>
              <span className="rounded-md bg-slate-900 px-2 py-1">
                Amazon Bedrock
              </span>
              <span className="rounded-md bg-slate-900 px-2 py-1">
                Evidence Grounded
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-[#0b111b] p-6 shadow-2xl">
            {!result ? (
              <div className="flex min-h-[530px] flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-2xl">
                  ◎
                </div>

                <h3 className="text-lg font-medium text-slate-300">
                  Awaiting incident analysis
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Add incident evidence or load the payment outage demo, then
                  run the AWS-powered analysis.
                </p>
              </div>
            ) : (
              <div>
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">
                      Incident Analysis
                    </p>

                    <h3 className="mt-2 text-2xl font-semibold">
                      Production Incident
                    </h3>
                  </div>

                  <span className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300">
                    {result.severity}
                  </span>
                </div>

                <div className="mb-4 rounded-xl border border-slate-800 bg-[#070b12] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Summary
                  </p>
                  <p className="text-sm leading-6 text-slate-300">
                    {result.summary}
                  </p>
                </div>

                <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    Probable Root Cause
                  </p>
                  <p className="text-sm leading-6 text-slate-300">
                    {result.root_cause}
                  </p>
                </div>

                <div className="mb-4 rounded-xl border border-slate-800 bg-[#070b12] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Model Confidence
                    </p>
                    <span className="text-sm font-semibold text-cyan-300">
                      {Math.round(result.confidence * 100)}%
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, result.confidence * 100)
                        )}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-[11px] text-slate-600">
                    Model-generated confidence; not a calibrated probability.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#070b12] p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Recommended Actions
                  </p>

                  <div className="space-y-3">
                    {result.recommended_actions?.map((action, index) => (
                      <div
                        key={`${action}-${index}`}
                        className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-500/10 text-xs font-semibold text-cyan-300">
                          {index + 1}
                        </span>

                        <p className="text-sm leading-6 text-slate-300">
                          {action}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200/80">
                  Human approval required before executing remediation actions.
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5 text-xs text-slate-600">
          <span>ResQ · Evidence-First Incident Response</span>
          <span>AWS Lambda → Amazon Bedrock</span>
        </footer>
      </div>
    </main>
  );
}