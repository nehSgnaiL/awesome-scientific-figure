import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const readmePath = path.join(root, "README.md");
const readme = fs.readFileSync(readmePath, "utf8");
const errors = [];
const warnings = [];

function githubSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

const headings = new Set(
  [...readme.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => githubSlug(match[1])),
);

for (const match of readme.matchAll(/\[[^\]]+\]\(#([^)]+)\)/g)) {
  if (!headings.has(match[1])) errors.push(`Broken README anchor: #${match[1]}`);
}

const localImages = new Set();
const imagePatterns = [
  /<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g,
  /!\[[^\]]*\]\(([^)]+)\)/g,
];

for (const pattern of imagePatterns) {
  for (const match of readme.matchAll(pattern)) {
    const source = match[1].split(/[?#]/, 1)[0];
    if (/^https?:\/\//.test(source)) {
      if (/raw\.githubusercontent\.com\/.*\/refs\/heads\//.test(source)) {
        warnings.push(`External image follows a mutable branch: ${source}`);
      }
      continue;
    }
    const relative = source.replace(/^\.\//, "");
    localImages.add(relative);
    if (!fs.existsSync(path.join(root, relative))) errors.push(`Missing local image: ${source}`);
  }
}

if (readme.includes("placehold.co")) errors.push("Remote placehold.co color swatches remain in README.md.");

const entryPattern = /^### ([^\r\n]+)([\s\S]*?)(?=^### |^## |(?![\s\S]))/gm;
let entryCount = 0;
for (const match of readme.matchAll(entryPattern)) {
  const [title, body] = [match[1], match[2]];
  entryCount += 1;
  if (!/^\d{4}-.+-.+$/.test(title)) warnings.push(`Non-standard entry heading: ${title}`);
  for (const [label, pattern] of [
    ["figure", /<img\b/],
    ["details", /<details>/],
    ["citation", /\*\*Citation(?: \(APA\))?:\*\*/],
    ["link", /\*\*Link:\*\*/],
    ["tag", /\*\*Tag:\*\*/],
  ]) {
    if (!pattern.test(body)) errors.push(`${title} is missing ${label} metadata.`);
  }
}

for (const relative of localImages) {
  if (relative.startsWith("figures/palettes/")) continue;
  const size = fs.statSync(path.join(root, relative)).size;
  if (size > 5 * 1024 * 1024) errors.push(`${relative} exceeds the 5 MiB image limit.`);
  else if (size > 1024 * 1024) warnings.push(`${relative} is ${(size / 1024 / 1024).toFixed(2)} MiB; consider lossless optimization.`);
}

for (const warning of warnings) console.warn(`::warning::${warning}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`::error::${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${entryCount} entries and ${localImages.size} local README images.`);
}
