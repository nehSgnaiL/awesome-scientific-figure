import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const readmePath = path.join(root, "README.md");
const paletteDir = path.join(root, "figures", "palettes");
const check = process.argv.includes("--check");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]);
}

function renderSvg(title, colors) {
  const swatchSize = 24;
  const height = swatchSize;
  const width = swatchSize * colors.length;
  const rectangles = colors.map((color, index) =>
    `  <rect x="${index * swatchSize}" y="0" width="${swatchSize}" height="${swatchSize}" fill="${color}" stroke="#d0d7de"/>`,
  ).join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title">`,
    `  <title id="title">${escapeXml(title)} color palette: ${colors.join(", ")}</title>`,
    rectangles,
    "</svg>",
    "",
  ].join("\n");
}

const original = fs.readFileSync(readmePath, "utf8");
const entryPattern = /(^### ([^\r\n]+)[\s\S]*?)(?=^### |^## |(?![\s\S]))/gm;
const palettes = new Map();

const updated = original.replace(entryPattern, (entry, _whole, title) => {
  const colorStart = entry.indexOf("**Color:**");
  if (colorStart === -1) return entry;

  const detailsEnd = entry.indexOf("</details>", colorStart);
  if (detailsEnd === -1) {
    throw new Error(`Color palette in "${title}" is outside a details block.`);
  }

  const colorSection = entry.slice(colorStart, detailsEnd);
  const colors = [...colorSection.matchAll(/#[0-9a-fA-F]{6}\b/g)]
    .map((match) => match[0].toUpperCase())
    .filter((color, index, all) => all.indexOf(color) === index);

  if (colors.length === 0) {
    throw new Error(`No hexadecimal colors found for "${title}".`);
  }

  const slug = slugify(title);
  const filename = `${slug}.svg`;
  palettes.set(filename, renderSvg(title, colors));

  const width = colors.length * 24;
  const replacement = [
    `**Color:** ${colors.map((color) => `\`${color}\``).join(" ")}`,
    "",
    "<!-- Palette asset and filename are generated; edit only the hex values above. -->",
    `<img alt="Color palette for ${title}: ${colors.join(", ")}" src="./figures/palettes/${filename}" width="${width}" height="24">`,
    "",
  ].join("\n");

  return entry.slice(0, colorStart) + replacement + entry.slice(detailsEnd);
});

const expectedFiles = new Set(palettes.keys());
const existingFiles = fs.existsSync(paletteDir)
  ? fs.readdirSync(paletteDir).filter((filename) => filename.endsWith(".svg"))
  : [];
const problems = [];

if (updated !== original) {
  if (check) {
    problems.push(
      "README.md palette markup is out of date. Run `node scripts/generate-palettes.mjs`; SVG filenames are generated automatically and must not be edited by hand.",
    );
  }
  else fs.writeFileSync(readmePath, updated);
}

if (!check) fs.mkdirSync(paletteDir, { recursive: true });

for (const [filename, content] of palettes) {
  const outputPath = path.join(paletteDir, filename);
  if (check) {
    if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, "utf8") !== content) {
      problems.push(`figures/palettes/${filename} is missing or out of date.`);
    }
  } else {
    fs.writeFileSync(outputPath, content);
  }
}

for (const filename of existingFiles) {
  if (!expectedFiles.has(filename)) {
    if (check) problems.push(`figures/palettes/${filename} is no longer referenced.`);
    else fs.rmSync(path.join(paletteDir, filename));
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`${check ? "Verified" : "Generated"} ${palettes.size} local palette strips.`);
}
