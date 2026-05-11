/**
 * Writes build-resources/app-icon.png (512x512) as a minimal photo-camera icon.
 * Design goal: simple silhouette readable at tiny title-bar/taskbar sizes.
 * Run: pnpm exec node scripts/generate-app-icon.mjs (from apps/desktop-media).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Jimp, rgbaToInt } from "jimp";

const dir = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(dir, "../build-resources/app-icon.png");
const icoOutPath = path.join(dir, "../build-resources/app-icon.ico");

const W = 512;
const H = 512;

const transparent = rgbaToInt(0, 0, 0, 0);
const ringDark = rgbaToInt(15, 23, 42, 255);
const ringLight = rgbaToInt(241, 245, 249, 255);
const cameraBody = rgbaToInt(30, 41, 59, 255);
const lensOuter = rgbaToInt(71, 85, 105, 255);
const lensInner = rgbaToInt(241, 245, 249, 255);
const viewFinder = rgbaToInt(56, 189, 248, 255);

const image = new Jimp({ width: W, height: H, color: transparent });

const cx = Math.round(W / 2);
const cy = Math.round(H / 2);
const outerR = 228;
const innerR = 210;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= outerR) {
      image.setPixelColor(ringDark, x, y);
    }
    if (d <= innerR) {
      image.setPixelColor(ringLight, x, y);
    }
  }
}

const bodyX = 106;
const bodyY = 170;
const bodyW = 300;
const bodyH = 188;
for (let y = bodyY; y < bodyY + bodyH; y++) {
  for (let x = bodyX; x < bodyX + bodyW; x++) {
    image.setPixelColor(cameraBody, x, y);
  }
}

const topX = 158;
const topY = 136;
const topW = 118;
const topH = 42;
for (let y = topY; y < topY + topH; y++) {
  for (let x = topX; x < topX + topW; x++) {
    image.setPixelColor(cameraBody, x, y);
  }
}

const vfX = bodyX + bodyW - 64;
const vfY = bodyY + 20;
const vfW = 34;
const vfH = 18;
for (let y = vfY; y < vfY + vfH; y++) {
  for (let x = vfX; x < vfX + vfW; x++) {
    image.setPixelColor(viewFinder, x, y);
  }
}

const lensCx = 256;
const lensCy = 262;
const lensOuterR = 64;
const lensInnerR = 34;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - lensCx, y - lensCy);
    if (d <= lensOuterR) {
      image.setPixelColor(lensOuter, x, y);
    }
    if (d <= lensInnerR) {
      image.setPixelColor(lensInner, x, y);
    }
  }
}

await image.write(outPath);

const icoPng = await image.clone().resize({ w: 256, h: 256 }).getBuffer("image/png");
const ico = Buffer.alloc(22 + icoPng.length);
ico.writeUInt16LE(0, 0); // reserved
ico.writeUInt16LE(1, 2); // icon
ico.writeUInt16LE(1, 4); // image count
ico.writeUInt8(0, 6); // 256px width
ico.writeUInt8(0, 7); // 256px height
ico.writeUInt8(0, 8); // no palette
ico.writeUInt8(0, 9); // reserved
ico.writeUInt16LE(1, 10); // color planes
ico.writeUInt16LE(32, 12); // bits per pixel
ico.writeUInt32LE(icoPng.length, 14);
ico.writeUInt32LE(22, 18);
icoPng.copy(ico, 22);
await fs.writeFile(icoOutPath, ico);

console.log("Wrote", outPath);
console.log("Wrote", icoOutPath);
