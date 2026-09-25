import type { Evidence } from "./schema.ts";

export const MAX_INPUT = 64_000;
export const MAX_LINES = 200;

// Conservative pattern-based redaction, not general-purpose PII detection.
// Preserve newlines so citations always map to the submitted line numbers.
export function redact(input: string) {
  const counts: Record<string, number> = {};
  let text = input.replace(/\r\n?/g, "\n");
  function replace(pattern: RegExp, label: string, prefix = false) {
    text = text.replace(pattern, (...match: string[]) => {
      if (match[0].includes("[REDACTED:")) return match[0];
      counts[label] = (counts[label] || 0) + 1;
      return `${prefix ? match[1] : ""}[REDACTED:${label}]`;
    });
  }
  text = text.replace(
    /-----BEGIN [^-\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\n]*PRIVATE KEY-----/g,
    (match) => {
      counts.PRIVATE_KEY = (counts.PRIVATE_KEY || 0) + 1;
      return match
        .split("\n")
        .map(() => "[REDACTED:PRIVATE_KEY]")
        .join("\n");
    },
  );
  replace(
    /((?:authorization|proxy-authorization)["']?\s*[:=]\s*["']?)(?:Bearer|Basic)\s+[^\s,"';]+/gi,
    "AUTH",
    true,
  );
  replace(
    /((?:password|passwd|pwd|secret|client_secret|api[_-]?key|access[_-]?token|refresh[_-]?token|token|aws_secret_access_key|aws_session_token)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;&]+)/gi,
    "SECRET",
    true,
  );
  replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "AWS_KEY");
  replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "JWT");
  replace(
    /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi,
    "URL_CREDENTIALS",
    true,
  );
  replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "EMAIL");
  replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "IP");
  replace(/(?<![\w:])(?:[0-9a-f]{1,4}:){2,}[0-9a-f:]{1,39}(?![\w:])/gi, "IP");
  replace(/\b\d{3}-\d{2}-\d{4}\b/g, "ID");
  replace(
    /((?:phone|mobile|name|full_name|user|user_id|customer_id|address)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/gi,
    "PERSONAL",
    true,
  );
  return { text, counts };
}

export function buildTimeline(redacted: string): Evidence[] {
  return redacted
    .split("\n")
    .flatMap((text, index) => {
      if (!text.trim()) return [];
      const token = text.match(
        /^\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))(?=\s|$)/,
      )?.[1];
      const date = token ? new Date(token) : null;
      const calendarDate = token
        ? new Date(`${token.slice(0, 10)}T00:00:00Z`)
        : null;
      const valid =
        date &&
        Number.isFinite(date.getTime()) &&
        calendarDate &&
        Number.isFinite(calendarDate.getTime()) &&
        calendarDate.toISOString().slice(0, 10) === token?.slice(0, 10) &&
        Number(token.slice(11, 13)) < 24;
      return [
        {
          id: `E${String(index + 1).padStart(4, "0")}`,
          lineNumber: index + 1,
          timestamp: valid ? date.toISOString() : null,
          text,
        },
      ];
    })
    .sort((a, b) => {
      if (a.timestamp === null && b.timestamp !== null) return 1;
      if (b.timestamp === null && a.timestamp !== null) return -1;
      return (
        (a.timestamp ?? "").localeCompare(b.timestamp ?? "") ||
        a.lineNumber - b.lineNumber
      );
    });
}

// Only strict timestamped key=value logs participate in the mechanism rule.
// Free-form prose is still preserved as evidence, but cannot establish causality.
export function fields(event: Evidence): Record<string, string> | null {
  if (!event.timestamp) return null;
  const tokens = event.text.trim().split(/\s+/);
  if (!/^(INFO|WARN|ERROR|CRITICAL|DEPLOY)$/.test(tokens[1] ?? "")) return null;
  const result: Record<string, string> = { level: tokens[1] };
  for (const token of tokens.slice(2)) {
    const pair = token.match(/^([a-z_]+)=([A-Za-z0-9_.:/%+-]+)$/);
    if (!pair || Object.hasOwn(result, pair[1])) return null;
    result[pair[1]] = pair[2];
  }
  return result;
}

export function poolSupport(evidence: Evidence[]): string[] {
  for (const saturation of evidence) {
    const a = fields(saturation);
    if (
      !a?.service ||
      !/^(WARN|ERROR|CRITICAL)$/.test(a.level) ||
      !/^\d+$/.test(a.db_connections ?? "") ||
      !/^\d+$/.test(a.max_connections ?? "")
    )
      continue;
    if (+a.max_connections <= 0 || +a.db_connections < +a.max_connections)
      continue;
    const timeout = evidence.find((event) => {
      const b = fields(event);
      const elapsed =
        Date.parse(event.timestamp ?? "") -
        Date.parse(saturation.timestamp ?? "");
      return (
        event.id !== saturation.id &&
        b?.service === a.service &&
        /^(ERROR|CRITICAL)$/.test(b.level) &&
        b.error === "ConnectionPoolTimeout" &&
        elapsed >= 0 &&
        elapsed <= 15 * 60_000
      );
    });
    if (timeout) return [saturation.id, timeout.id];
  }
  return [];
}

export function observedSeverity(evidence: Evidence[]) {
  const levels = evidence.map((e) => fields(e)?.level);
  return levels.includes("CRITICAL")
    ? "critical"
    : levels.includes("ERROR")
      ? "high"
      : levels.includes("WARN")
        ? "medium"
        : "unknown";
}
