import { readFile } from "node:fs/promises";
import { responseHeaders } from "@/lib/http";
const allowed = new Set(["well-evidenced", "ambiguous", "redaction-test"]);
export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  if (!allowed.has(name))
    return Response.json({ error: "Unknown fixture" }, { status: 404 });
  const incident = await readFile(
    `${process.cwd()}/fixtures/${name}.txt`,
    "utf8",
  );
  return Response.json({ incident }, { headers: responseHeaders });
}
