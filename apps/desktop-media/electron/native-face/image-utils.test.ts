import { describe, expect, it } from "vitest";
import { rotateRgb, type RawImage } from "./image-utils";

function make2x2(): RawImage {
  // Layout (rows of pixels, each pixel = RGB):
  //   (r=1,g=2,b=3)  (r=4,g=5,b=6)
  //   (r=7,g=8,b=9)  (r=10,g=11,b=12)
  const data = new Uint8Array([
    1, 2, 3, 4, 5, 6,
    7, 8, 9, 10, 11, 12,
  ]);
  return { data, width: 2, height: 2, channels: 3 };
}

function pixel(image: RawImage, x: number, y: number): [number, number, number] {
  const off = (y * image.width + x) * 3;
  return [image.data[off], image.data[off + 1], image.data[off + 2]];
}

describe("rotateRgb", () => {
  it("returns an independent copy when degrees=0", () => {
    const img = make2x2();
    const out = rotateRgb(img, 0);
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect(Array.from(out.data)).toEqual(Array.from(img.data));
    out.data[0] = 99;
    expect(img.data[0]).toBe(1);
  });

  it("rotates 90° clockwise", () => {
    // After 90°CW:
    //   top-left of original -> top-right of rotated
    //   (0,0)->(1,0), (1,0)->(1,1), (1,1)->(0,1), (0,1)->(0,0)
    const out = rotateRgb(make2x2(), 90);
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect(pixel(out, 1, 0)).toEqual([1, 2, 3]);
    expect(pixel(out, 1, 1)).toEqual([4, 5, 6]);
    expect(pixel(out, 0, 1)).toEqual([10, 11, 12]);
    expect(pixel(out, 0, 0)).toEqual([7, 8, 9]);
  });

  it("rotates 180°", () => {
    const out = rotateRgb(make2x2(), 180);
    expect(pixel(out, 1, 1)).toEqual([1, 2, 3]);
    expect(pixel(out, 0, 1)).toEqual([4, 5, 6]);
    expect(pixel(out, 1, 0)).toEqual([7, 8, 9]);
    expect(pixel(out, 0, 0)).toEqual([10, 11, 12]);
  });

  it("rotates 270° clockwise", () => {
    // 270°CW (= 90°CCW): (0,0)->(0,1), (1,0)->(0,0), (1,1)->(1,0), (0,1)->(1,1)
    const out = rotateRgb(make2x2(), 270);
    expect(pixel(out, 0, 1)).toEqual([1, 2, 3]);
    expect(pixel(out, 0, 0)).toEqual([4, 5, 6]);
    expect(pixel(out, 1, 0)).toEqual([10, 11, 12]);
    expect(pixel(out, 1, 1)).toEqual([7, 8, 9]);
  });

  it("swaps dimensions on 90° and 270°", () => {
    const img: RawImage = {
      data: new Uint8Array(3 * 4 * 3), // 3x4 image
      width: 3,
      height: 4,
      channels: 3,
    };
    expect(rotateRgb(img, 90).width).toBe(4);
    expect(rotateRgb(img, 90).height).toBe(3);
    expect(rotateRgb(img, 270).width).toBe(4);
    expect(rotateRgb(img, 270).height).toBe(3);
    expect(rotateRgb(img, 180).width).toBe(3);
    expect(rotateRgb(img, 180).height).toBe(4);
  });
});
