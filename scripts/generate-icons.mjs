import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgBuffer = readFileSync(resolve(__dirname, "../public/favicon.svg"));

const outputs = [
  { path: "public/icons/icon-192.png", size: 192 },
  { path: "public/icons/icon-512.png", size: 512 },
  { path: "public/apple-touch-icon.png", size: 180 },
];

for (const { path, size } of outputs) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(resolve(__dirname, "..", path));
  console.log(`Generated ${path} (${size}x${size})`);
}

await sharp(svgBuffer).resize(32, 32).toFile(resolve(__dirname, "../public/favicon.ico"));
console.log("Generated public/favicon.ico (32x32)");
