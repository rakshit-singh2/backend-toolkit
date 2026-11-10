import { writeFile, mkdir } from "fs/promises";
import path from "path";

const outDir = path.resolve("dist/cjs");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "package.json"), JSON.stringify({ type: "commonjs" }, null, 2) + "\n");
