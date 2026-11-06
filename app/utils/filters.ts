export type FilterId =
  | "none"
  | "kodak"
  | "fuji"
  | "flash"
  | "muted"
  | "bw"
  | "grain"
  | "pixel";

export interface FilterOption {
  id: FilterId;
  name: string;
  nameEn: string;
  badge: string;
  cssFilter: string;
}

export const FILTERS: FilterOption[] = [
  {
    id: "none",
    name: "原图",
    nameEn: "Normal",
    badge: "NATURAL",
    cssFilter: "none",
  },
  {
    id: "kodak",
    name: "柯达 90s",
    nameEn: "Kodak 90s",
    badge: "WARM",
    cssFilter: "sepia(0.22) saturate(1.25) contrast(1.1) brightness(1.02)",
  },
  {
    id: "fuji",
    name: "富士日系",
    nameEn: "Fuji Pastel",
    badge: "CLEAN",
    cssFilter: "contrast(1.06) brightness(1.08) saturate(1.05) hue-rotate(-6deg)",
  },
  {
    id: "flash",
    name: "梦幻泛光",
    nameEn: "Flash Bloom",
    badge: "GLOW",
    cssFilter: "contrast(1.2) brightness(1.15) saturate(1.15)",
  },
  {
    id: "muted",
    name: "复古浅淡",
    nameEn: "Muted Film",
    badge: "RETRO",
    cssFilter: "saturate(0.7) contrast(1.08) sepia(0.12)",
  },
  {
    id: "bw",
    name: "经典黑白",
    nameEn: "Classic B&W",
    badge: "B&W",
    cssFilter: "grayscale(1) contrast(1.35) brightness(1.02)",
  },
  {
    id: "grain",
    name: "胶片颗粒",
    nameEn: "Film Grain",
    badge: "GRAIN",
    cssFilter: "contrast(1.15) brightness(1.02) sepia(0.1)",
  },
  {
    id: "pixel",
    name: "千禧像素",
    nameEn: "Y2K Pixel",
    badge: "8-BIT",
    cssFilter: "contrast(1.3) saturate(1.2)",
  },
];

/**
 * Apply the selected filter, film grain, pixelation, and aperture effect onto a canvas
 */
export function applyFilterToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  filterId: FilterId,
  apertureValue: number // 1.4 (wide/blur) to 16 (sharp)
) {
  // 1. Pixelation filter
  if (filterId === "pixel") {
    const pixelSize = Math.max(6, Math.floor(width / 110));
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y += pixelSize) {
      for (let x = 0; x < width; x += pixelSize) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        for (let py = 0; py < pixelSize && y + py < height; py++) {
          for (let px = 0; px < pixelSize && x + px < width; px++) {
            const pi = ((y + py) * width + (x + px)) * 4;
            data[pi] = r;
            data[pi + 1] = g;
            data[pi + 2] = b;
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // 2. Film Grain filter
  if (filterId === "grain") {
    const grainImg = ctx.getImageData(0, 0, width, height);
    const d = grainImg.data;
    const intensity = 32;

    for (let i = 0; i < d.length; i += 4) {
      const noise = (Math.random() - 0.5) * intensity;
      d[i] = Math.min(255, Math.max(0, d[i] + noise));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise));
    }
    ctx.putImageData(grainImg, 0, 0);
  }

  // 3. Black and white filter
  if (filterId === "bw") {
    const bwImg = ctx.getImageData(0, 0, width, height);
    const d = bwImg.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      // High contrast curve
      const contrast = 1.3;
      const adjusted = Math.min(255, Math.max(0, (gray - 128) * contrast + 128));
      d[i] = adjusted;
      d[i + 1] = adjusted;
      d[i + 2] = adjusted;
    }
    ctx.putImageData(bwImg, 0, 0);
  }

  // 4. Aperture / Depth-of-Field Vignette effect
  // f/1.4 = wide aperture (soft dreamy peripheral bokeh/vignette)
  // f/16 = small aperture (crisp edge-to-edge)
  if (apertureValue < 8) {
    const maxAperture = 1.4;
    const factor = Math.max(0, (8 - apertureValue) / (8 - maxAperture)); // 0 to 1

    ctx.save();
    // Radial aperture focus vignette
    const cx = width / 2;
    const cy = height / 2;
    const innerR = Math.min(width, height) * (0.35 + (1 - factor) * 0.25);
    const outerR = Math.max(width, height) * 0.75;

    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${(factor * 0.38).toFixed(2)})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
