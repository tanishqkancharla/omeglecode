/** Worker script name from wrangler.jsonc and alchemy.run.ts. */
export const workerScriptName = "omeglecode";

/**
 * Cloudflare account that owns the omeglecode worker. Confirmed from the
 * dashboard login for Tanishqkancharla3@gmail.com's Account. Not a secret.
 */
export const cloudflareAccountId = "f0cf70001c376c51dd92217b2392f337";

/** Durable Object classes bound on this worker. */
export const durableObjectClasses = ["Matchmaker", "ChatRoom"] as const;
