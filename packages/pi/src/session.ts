import { sessionHash } from "@omeglecode/client";

const processStart = Date.now();

export async function piSessionKey(
  cwd: string,
  sessionFile: string | undefined,
): Promise<string> {
  if (sessionFile) return sessionHash(`pi:${sessionFile}`);
  return sessionHash(`pi:ephemeral:${cwd}:${processStart}`);
}

export { processStart };
