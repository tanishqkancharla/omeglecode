#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

if (process.argv[2] !== "install" || process.argv[3] !== undefined) {
  console.error("Usage: npx --yes opencode-omeglecode@latest install");
  process.exit(1);
}

let paths;
try {
  paths = execFileSync("opencode2", ["debug", "paths"], { encoding: "utf8" });
} catch {
  console.error(
    "OpenCode v2 is required. Install it with: npm install --global @opencode-ai/cli@beta",
  );
  process.exit(1);
}

const value = (name) => {
  const match = paths.match(new RegExp(`^${name}\\s+(.+)$`, "m"));
  if (!match) throw new Error(`OpenCode did not report its ${name} path`);
  return match[1].trim();
};

const config = value("config");
const cache = value("cache");
execFileSync("opencode2", ["plugin", "add", "opencode-omeglecode"], {
  stdio: "inherit",
});

const entrypoint = path.join(
  cache,
  "packages",
  "opencode-omeglecode",
  "node_modules",
  "opencode-omeglecode",
  "dist",
  "tui.js",
);
if (!existsSync(entrypoint))
  throw new Error(`Plugin was not installed at ${entrypoint}`);

mkdirSync(config, { recursive: true });
const file = path.join(config, "cli.json");
const current = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : { $schema: "https://opencode.ai/v2/cli.json" };
const plugins = Array.isArray(current.plugins) ? current.plugins : [];
current.plugins = [
  ...plugins.filter((plugin) => {
    if (typeof plugin === "string")
      return !plugin.includes("opencode-omeglecode");
    return plugin?.package !== entrypoint;
  }),
  { package: entrypoint, options: {} },
];
writeFileSync(file, `${JSON.stringify(current, undefined, 2)}\n`);

console.log("Omeglecode installed.");
console.log("Start OpenCode with: opencode2");
console.log("Then join a room with: /omegle-connect ROOM_ID");
