#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
const target = process.argv[3] ?? "opencode";

if (command !== "install" || (target !== "opencode" && target !== "pi")) {
  console.error("Usage: npx --yes opencode-omeglecode@latest install");
  console.error("       npx --yes opencode-omeglecode@latest install pi");
  process.exit(1);
}

if (target === "pi") installPi();
else installOpenCode();

function installPi() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const bundle = [
    path.join(here, "pi-omeglecode.js"),
    path.join(here, "..", "pi", "dist", "index.js"),
    path.join(here, "..", "..", "pi", "dist", "index.js"),
  ].find((file) => existsSync(file));
  if (!bundle) {
    console.error(
      "Pi extension bundle not found. Build it with: pnpm --filter pi-omeglecode build",
    );
    console.error("Or install from npm with: pi install npm:pi-omeglecode");
    process.exit(1);
  }

  const destDir = path.join(os.homedir(), ".pi", "agent", "extensions", "omeglecode");
  mkdirSync(destDir, { recursive: true });
  copyFileSync(bundle, path.join(destDir, "index.js"));
  writeFileSync(
    path.join(destDir, "package.json"),
    `${JSON.stringify(
      {
        name: "omeglecode-pi-extension",
        private: true,
        type: "module",
        pi: { extensions: ["./index.js"] },
      },
      undefined,
      2,
    )}\n`,
  );
  console.log("Omeglecode installed for Pi.");
  console.log(`Wrote ${path.join(destDir, "index.js")}`);
  console.log("Start Pi, then run /omegle-nickname.");
  console.log("Join the same rooms as OpenCode with: /omegle-connect ROOM_ID");
}

function installOpenCode() {
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
  rmSync(path.join(cache, "packages", "opencode-omeglecode"), {
    recursive: true,
    force: true,
  });
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
}
