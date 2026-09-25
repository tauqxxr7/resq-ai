import { providerStatus } from "@/lib/providers";
import { responseHeaders } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const status = providerStatus();
  return Response.json(
    { ...status, checkedAt: new Date().toISOString() },
    { status: status.configured ? 200 : 503, headers: responseHeaders },
  );
}
