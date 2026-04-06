import sharp from "sharp";
import pngToIco from "png-to-ico";
import { readFileSync, writeFileSync } from "fs";
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
  await sharp(svgBuffer, { density: 384 })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(resolve(__dirname, "..", path));
  console.log(`Generated ${path} (${size}x${size})`);
}

const icoSizes = [16, 32, 48];
const icoBuffers = await Promise.all(
  icoSizes.map((s) =>
    sharp(svgBuffer, { density: 384 })
      .resize(s, s, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer(),
  ),
);
writeFileSync(
  resolve(__dirname, "../public/favicon.ico"),
  await pngToIco(icoBuffers),
);
console.log(`Generated public/favicon.ico (${icoSizes.join("/")})`);
