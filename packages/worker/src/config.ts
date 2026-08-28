/** Worker script name from wrangler.jsonc and alchemy.run.ts. */
export const workerScriptName = "omeglecode";

/** Durable Object classes bound on this worker. */
export const durableObjectClasses = ["Matchmaker", "ChatRoom"] as const;
