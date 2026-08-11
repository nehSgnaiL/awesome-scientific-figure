import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pagesDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(pagesDirectory, "..", "..");
const sourceDirectory = path.join(pagesDirectory, ".build", "source");
const repositoryUrl =
  "https://github.com/nehSgnaiL/awesome-scientific-figure";

fs.rmSync(sourceDirectory, { recursive: true, force: true });
fs.mkdirSync(sourceDirectory, { recursive: true });

function copyIntoSource(sourceRoot, relativePaths) {
  for (const relativePath of relativePaths) {
    fs.cpSync(
      path.join(sourceRoot, relativePath),
      path.join(sourceDirectory, relativePath),
      { recursive: true },
    );
  }
}

copyIntoSource(pagesDirectory, ["_config.yml", "_layouts", "assets"]);
copyIntoSource(repositoryRoot, ["figures", "auto/palettes"]);

const readme = fs
  .readFileSync(path.join(repositoryRoot, "README.md"), "utf8")
  .replaceAll(
    "](CONTRIBUTING.md)",
    `](${repositoryUrl}/blob/main/CONTRIBUTING.md)`,
  );
fs.writeFileSync(
  path.join(sourceDirectory, "index.md"),
  `---\nlayout: default\npermalink: /\n---\n\n${readme}`,
);

console.log(
  `Prepared Pages source in ${path.relative(repositoryRoot, sourceDirectory)}`,
);
