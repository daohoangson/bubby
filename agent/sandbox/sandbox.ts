import { defineSandbox } from "eve/sandbox";
import { DockerSandbox } from "eve/sandbox/docker";
import { VercelSandbox } from "eve/sandbox/vercel";
import type { SandboxSession } from "eve/sandbox";

async function prepare(sandbox: SandboxSession) {
  const result = await sandbox.run({
    command: "cd /workspace && npm ci --omit=dev --no-audit --no-fund",
  });
  if (result.exitCode !== 0) {
    throw new Error(`Sandbox dependency installation failed: ${result.stderr}`);
  }
}

export const environment = process.env.VERCEL
  ? VercelSandbox.environment({ prepare })
  : DockerSandbox.environment({ prepare });
export default defineSandbox(() => environment.open());
