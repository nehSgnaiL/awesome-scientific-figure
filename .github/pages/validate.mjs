import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pagesDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(pagesDirectory, "..", "..");
const sourceDirectory = path.join(pagesDirectory, ".build", "source");
const layout = fs.readFileSync(path.join(pagesDirectory, "_layouts", "default.html"), "utf8");
const styles = fs.readFileSync(path.join(pagesDirectory, "assets", "css", "page.scss"), "utf8");
const config = fs.readFileSync(path.join(pagesDirectory, "_config.yml"), "utf8");
const workflow = fs.readFileSync(path.join(repositoryRoot, ".github", "workflows", "pages.yml"), "utf8");
const errors = [];

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) errors.push(message);
}

function rejectMatch(source, pattern, message) {
  if (pattern.test(source)) errors.push(message);
}

requireMatch(layout, /<script src="\/shared\/site-shell\.js" defer><\/script>/, "Layout must load the shared site shell.");
requireMatch(layout, /<shen-site-header><\/shen-site-header>/, "Layout is missing the shared header.");
requireMatch(layout, /<shen-site-footer><\/shen-site-footer>/, "Layout is missing the shared footer.");
requireMatch(layout, /'\/assets\/css\/page\.css\?v='/, "Layout must load the isolated Pages stylesheet.");
requireMatch(layout, /customElements\.whenDefined\("shen-site-header"\)[\s\S]*?site-header-ready/, "Layout must release the stable header slot after the shared header loads.");
requireMatch(layout, /name="theme-color" content="#007aff" media="\(prefers-color-scheme: light\)"[\s\S]*?name="theme-color" content="#0a84ff" media="\(prefers-color-scheme: dark\)"/, "Layout must match the portfolio mobile status-bar colors.");
requireMatch(layout, /shadowRoot\?\.querySelector\("\[src\]"\)/, "Layout must observe the shared header frame instead of its style element.");
rejectMatch(layout, /\b(?:iframe|postMessage|MessageEvent)\b|\/shared\/(?!site-shell\.js)/i, "Layout must not duplicate the shared shell.");

requireMatch(styles, /html\[data-theme="dark"\]/, "Styles must respond to the shared shell dark theme.");
requireMatch(styles, /@media \(prefers-color-scheme: dark\)/, "Styles must retain a system dark-theme fallback.");
requireMatch(styles, /html\[data-theme="dark"\][\s\S]*?--repo-surface:\s*#1c1c1eb3[\s\S]*?html:not\(\[data-theme\]\)[\s\S]*?--repo-surface:\s*#1c1c1eb3/, "Dark content surfaces must match the portfolio glass background.");
requireMatch(styles, /body[\s\S]*?background:\s*var\(--repo-backdrop\),\s*var\(--repo-bg\)[\s\S]*?html\[data-theme="dark"\][\s\S]*?--repo-backdrop:\s*linear-gradient[\s\S]*?html:not\(\[data-theme\]\)[\s\S]*?--repo-backdrop:\s*linear-gradient/, "Dark page backgrounds must match the portfolio backdrop.");
requireMatch(styles, /\.repo-button-primary[\s\S]*?linear-gradient\(/, "The primary repository action must retain the blue portfolio treatment.");
requireMatch(styles, /\.repo-button[\s\S]*?backdrop-filter:\s*blur\(20px\) saturate\(180%\)/, "Repository actions must retain the portfolio glass treatment.");
requireMatch(styles, /--repo-button-link:\s*#007aff/, "The secondary repository action must use the portfolio link color.");
requireMatch(styles, /\.repo-button-primary:visited[\s\S]*?color:\s*#ffffff !important/, "The primary repository action must remain white after visiting.");
requireMatch(styles, /@media \(max-width: 600px\)[\s\S]*?\.markdown-body \.repo-button[\s\S]*?flex:\s*0 0 auto/, "Mobile repository actions must stay fitted to their text.");
requireMatch(styles, /shen-site-header[\s\S]*?height:\s*73px[\s\S]*?@media \(max-width: 639px\)[\s\S]*?height:\s*101px/, "Shared header space must stay stable while its iframe loads.");
for (const match of styles.matchAll(/--([\w-]+)\s*:/g)) {
  if (!match[1].startsWith("repo-")) errors.push("Page styles may define only repository-scoped custom properties.");
}

requireMatch(config, /^baseurl:\s*\/awesome-scientific-figure\s*$/m, "Jekyll base URL must match the project page.");
requireMatch(workflow, /node \.github\/pages\/build-source\.mjs/, "Pages workflow must prepare the isolated source directory.");
requireMatch(workflow, /actions\/deploy-pages@v5/, "Pages workflow must deploy through the supported Pages action.");

for (const forbiddenRootPath of ["_config.yml", "_layouts"]) {
  if (fs.existsSync(path.join(repositoryRoot, forbiddenRootPath))) {
    errors.push(`Pages implementation must not create ${forbiddenRootPath} at the repository root.`);
  }
}

for (const generatedPath of ["index.md", "figures", "auto/palettes"]) {
  if (!fs.existsSync(path.join(sourceDirectory, generatedPath))) {
    errors.push(`Generated Pages source is missing ${generatedPath}.`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`::error::${error}`);
  process.exitCode = 1;
} else {
  console.log("Validated the isolated Pages source and shared-shell boundary.");
}
