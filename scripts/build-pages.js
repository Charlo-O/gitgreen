import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(projectRoot, "dist", "pages");

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

await fs.cp(path.join(projectRoot, "public"), outDir, { recursive: true });
await fs.cp(
  path.join(projectRoot, "node_modules", "lucide-static", "icons"),
  path.join(outDir, "icons"),
  { recursive: true }
);

console.log(`Built GitHub Pages artifact at ${path.relative(projectRoot, outDir)}`);
