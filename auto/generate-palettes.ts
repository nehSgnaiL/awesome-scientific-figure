import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const readmePath = path.join(root, "README.md");
const paletteDir = path.join(root, "auto", "palettes");
const check = process.argv.includes("--check");

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeXml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

function deferImageLoading(tag: string): string {
  const attributes: string[] = [];
  if (!/\bloading=/.test(tag)) attributes.push('loading="lazy"');
  if (!/\bdecoding=/.test(tag)) attributes.push('decoding="async"');
  if (attributes.length === 0) return tag;

  const closing = tag.endsWith("/>") ? "/>" : ">";
  return `${tag.slice(0, -closing.length)} ${attributes.join(" ")}${closing}`;
}

function renderSvg(title: string, colors: string[]): string {
  const swatchSize = 24;
  const height = swatchSize;
  const width = swatchSize * colors.length;
  const rectangles = colors.map((color, index) =>
    `  <rect x="${index * swatchSize}" y="0" width="${swatchSize}" height="${swatchSize}" fill="${color}"/>`,
  ).join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title">`,
    `  <title id="title">${escapeXml(title)} color palette: ${colors.join(", ")}</title>`,
    rectangles,
    "</svg>",
    "",
  ].join("\n");
}

const originalRaw = fs.readFileSync(readmePath, "utf8");
const outputEol = originalRaw.includes("\r\n") ? "\r\n" : "\n";
const original = originalRaw.replace(/\r\n/g, "\n");
const entryPattern = /^[ \t]*(?:###\s+([^\r\n]+)|<h3(?:\s[^>]*)?>[ \t]*([^<\r\n]+?)[ \t]*<\/h3>)[ \t]*\r?\n[\s\S]*?(?=^[ \t]*(?:###\s+|<h3(?:\s[^>]*)?>|##\s+)|(?![\s\S]))/gmi;
const palettes = new Map<string, string>();
let entryCount = 0;

const updated = original.replace(entryPattern, (entry, markdownTitle, htmlTitle) => {
  entryCount += 1;
  const title = (markdownTitle ?? htmlTitle).trim();
  const normalizedEntry = entry
    .replace(
      /^([ \t]*<h3(?:\s[^>]*)?>)[ \t]*([^<\r\n]+?)[ \t]*(<\/h3>)/i,
      (_heading, opening, _currentTitle, closing) => `${opening}${title}${closing}`,
    )
    .replace(/<img\b[^>]*>/g, deferImageLoading)
    .replace(/<details(?![^>]*\bmarkdown=)([^>]*)>/g, '<details markdown="1"$1>');
  const colorStart = normalizedEntry.indexOf("**Color:**");
  if (colorStart === -1) return normalizedEntry;

  const detailsEnd = normalizedEntry.indexOf("</details>", colorStart);
  if (detailsEnd === -1) {
    throw new Error(`Color palette in "${title}" is outside a details block.`);
  }

  const colorSection = normalizedEntry.slice(colorStart, detailsEnd);
  const colors = [...colorSection.matchAll(/#[0-9a-fA-F]{6}\b/g)]
    .map((match) => match[0].toUpperCase())
    .filter((color, index, all) => all.indexOf(color) === index);

  if (colors.length === 0) {
    throw new Error(`No hexadecimal colors found for "${title}".`);
  }

  const slug = slugify(title);
  const svg = renderSvg(title, colors);
  const contentHash = createHash("sha256").update(svg).digest("hex").slice(0, 8);
  const filename = `${slug}-${contentHash}.svg`;
  palettes.set(filename, svg);

  const width = colors.length * 24;
  const replacement = [
    `**Color:** ${colors.map((color) => `\`${color}\``).join(" ")}`,
    "",
    `<img alt="Color palette for ${title}: ${colors.join(", ")}" src="./auto/palettes/${filename}" width="${width}" height="24" loading="lazy" decoding="async">`,
    "",
  ].join("\n");

  return normalizedEntry.slice(0, colorStart) + replacement + normalizedEntry.slice(detailsEnd);
});

if (entryCount === 0) {
  throw new Error("No README entries found; expected headings using `###` or `<h3>...</h3>`. Refusing to modify palette assets.");
}

const expectedFiles = new Set(palettes.keys());
const existingFiles = fs.existsSync(paletteDir)
  ? fs.readdirSync(paletteDir).filter((filename) => filename.endsWith(".svg"))
  : [];
const problems: string[] = [];

if (updated !== original) {
  if (check) {
    problems.push(
      "README.md palette markup is out of date. Run `node auto/generate-palettes.ts`; SVG filenames are generated automatically and must not be edited by hand.",
    );
  }
  else fs.writeFileSync(readmePath, updated.replace(/\n/g, outputEol));
}

if (!check) fs.mkdirSync(paletteDir, { recursive: true });

for (const [filename, content] of palettes) {
  const outputPath = path.join(paletteDir, filename);
  if (check) {
    const existing = fs.existsSync(outputPath)
      ? fs.readFileSync(outputPath, "utf8").replace(/\r\n/g, "\n")
      : null;
    if (existing !== content) {
      problems.push(`auto/palettes/${filename} is missing or out of date.`);
    }
  } else {
    fs.writeFileSync(outputPath, content);
  }
}

for (const filename of existingFiles) {
  if (!expectedFiles.has(filename)) {
    if (check) problems.push(`auto/palettes/${filename} is no longer referenced.`);
    else fs.rmSync(path.join(paletteDir, filename));
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`${check ? "Verified" : "Generated"} ${palettes.size} local palette strips.`);
}
