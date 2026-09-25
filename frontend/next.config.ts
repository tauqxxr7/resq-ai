import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Thread workers also run in restricted Windows environments without child IPC pipes.
  experimental: { workerThreads: true, cpus: 2, useTypeScriptCli: false },
  outputFileTracingIncludes: { "/api/fixtures/*": ["./fixtures/*.txt"] },
};

export default nextConfig;
