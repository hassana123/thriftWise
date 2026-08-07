import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public");
const regular = fs.readFileSync(path.join(__dirname, "icon.svg"));
const maskable = fs.readFileSync(path.join(__dirname, "icon-maskable.svg"));

async function main() {
  await sharp(regular).resize(192, 192).png().toFile(path.join(outDir, "icon-192.png"));
  await sharp(regular).resize(512, 512).png().toFile(path.join(outDir, "icon-512.png"));
  await sharp(maskable).resize(512, 512).png().toFile(path.join(outDir, "icon-512-maskable.png"));
  await sharp(regular).resize(180, 180).png().toFile(path.join(outDir, "apple-icon.png"));
  console.log("Icons generated in public/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
