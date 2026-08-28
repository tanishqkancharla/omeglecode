import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const worker = join(root, "..");

// Maui's themeFoucScript (maui/src/theme/themeFoucScript.ts). Inlined here
// because the published ESM barrel omits .js extensions Node can't import.
const themeFoucScript = `(function () {
	var preference = "system"
	try {
		var storedPreference = window.localStorage.getItem("maui-theme")
		if (
			storedPreference === "system" ||
			storedPreference === "light" ||
			storedPreference === "dark"
		) {
			preference = storedPreference
		}
	} catch {}

	var theme =
		preference === "system"
			? window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light"
			: preference

	document.documentElement.dataset.theme = theme
	document.documentElement.style.colorScheme = theme
})()`;

const result = await esbuild.build({
  absWorkingDir: worker,
  entryPoints: ["live/main.tsx"],
  bundle: true,
  format: "iife",
  minify: true,
  write: false,
  jsx: "automatic",
  treeShaking: true,
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

const file = result.outputFiles[0];
if (!file) throw new Error("esbuild produced no output");

const script = file.text.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Omeglecode live</title>
    <script>${themeFoucScript}</script>
  </head>
  <body>
    <div id="root"></div>
    <script>${script}</script>
  </body>
</html>
`;

const generatedDir = join(worker, "src/generated");
mkdirSync(generatedDir, { recursive: true });
writeFileSync(
  join(generatedDir, "livePage.ts"),
  `export const livePageHtml = ${JSON.stringify(html)};\n`,
);
console.log(
  `live page ${new TextEncoder().encode(html).length} bytes (client ${file.text.length} bytes)`,
);
