import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.resolve(__dirname, "../../../packages/manifest.json");
export const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));