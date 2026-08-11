import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const layout = fs.readFileSync(path.join(root, "_layouts", "default.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "auto", "page.scss"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const paletteGenerator = fs.readFileSync(path.join(root, "auto", "generate-palettes.ts"), "utf8");
const config = fs.readFileSync(path.join(root, "_config.yml"), "utf8");
const errors: string[] = [];

function requireMatch(source: string, pattern: RegExp, message: string): void {
  if (!pattern.test(source)) errors.push(message);
}

function rejectMatch(source: string, pattern: RegExp, message: string): void {
  if (pattern.test(source)) errors.push(message);
}

requireMatch(layout, /<script src="\/shared\/site-shell\.js" defer><\/script>/, "Page layout must load only the same-origin shared site shell.");
requireMatch(layout, /'\/auto\/page\.css\?v='/, "Page layout must load the repository stylesheet from the existing auto directory.");
requireMatch(layout, /<shen-site-header><\/shen-site-header>/, "Page layout is missing the shared header element.");
requireMatch(layout, /<shen-site-footer><\/shen-site-footer>/, "Page layout is missing the shared footer element.");
requireMatch(layout, /<meta name="referrer" content="strict-origin-when-cross-origin">/, "Page layout must use the site referrer policy.");
rejectMatch(layout, /<script(?! src="\/shared\/site-shell\.js" defer><\/script>)[\s>]/, "Page layout must not publish inline or third-party scripts.");
rejectMatch(layout, /\b(?:iframe|postMessage|MessageEvent)\b|\/shared\/(?!site-shell\.js)/i, "Page layout must not duplicate the shared shell implementation.");

requireMatch(styles, /html\[data-theme="dark"\]/, "Page styles must respond to an explicit shared-shell dark theme.");
requireMatch(styles, /@media \(prefers-color-scheme: dark\)/, "Page styles must retain the system dark-theme fallback.");
rejectMatch(
  styles,
  /(?:\bglass(?:-|\b)|backdrop-filter|color-mix\(|(?:radial|linear)-gradient\(|box-shadow)/i,
  "Page styles must remain a plain repository-specific presentation layer.",
);
for (const match of styles.matchAll(/--([\w-]+)\s*:/g)) {
  if (!match[1].startsWith("repo-")) errors.push("Page styles may define only repository-scoped custom properties.");
}

rejectMatch(readme, /<!--[\s\S]*?-->/, "README must not publish generator instructions in HTML comments.");
rejectMatch(paletteGenerator, /<!--/, "Palette automation must not reinsert public HTML comments.");
requireMatch(config, /^baseurl:\s*\/awesome-scientific-figure\s*$/m, "Jekyll base URL must remain scoped to the repository page.");
for (const maintenanceSource of ["generate-palettes.ts", "validate-readme.ts", "validate-page-shell.ts"]) {
  requireMatch(
    config,
    new RegExp(`^\\s*-\\s*auto/${maintenanceSource.replace(".", "\\.")}\\s*$`, "m"),
    `Jekyll must exclude auto/${maintenanceSource} from the generated site.`,
  );
}

if (errors.length > 0) {
  for (const error of errors) console.error(`::error::${error}`);
  process.exitCode = 1;
} else {
  console.log("Validated the minimal shared-shell page boundary.");
}
