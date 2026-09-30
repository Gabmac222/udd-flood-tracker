import { cpSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
if (!existsSync("dist/index.html")) throw new Error("Run npm run build first.");
mkdirSync("docs", { recursive: true });
cpSync("dist", "docs", { recursive: true });
writeFileSync("docs/.nojekyll", "");
console.log(
  "GitHub Pages files prepared in docs/. Commit that folder with your source changes.",
);
