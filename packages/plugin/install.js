#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const room = process.argv[2];
if (room !== undefined && !/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$/.test(room)) {
  console.error(
    "Room codes must be 3–32 letters, numbers, dashes, or underscores.",
  );
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
const options = room === undefined ? {} : { room };
current.plugins = [
  ...plugins.filter((plugin) => {
    if (typeof plugin === "string")
      return !plugin.includes("opencode-omeglecode");
    return plugin?.package !== entrypoint;
  }),
  { package: entrypoint, options },
];
writeFileSync(file, `${JSON.stringify(current, undefined, 2)}\n`);

console.log(
  `Omeglecode installed${room === undefined ? "" : ` with room ${room}`}.`,
);
console.log("Start OpenCode with: opencode2");
