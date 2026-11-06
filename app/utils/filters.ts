export type FilterId =
  | "none"
  | "haru"
  | "polaroid"
  | "hk"
  | "glam"
  | "fisheye"
  | "cyber"
  | "bw"
  | "grain"
  | "pixel";

export interface FilterOption {
  id: FilterId;
  name: string;
  nameEn: string;
  badge: string;
  desc: string;
  cssFilter: string;
}

export const FILTERS: FilterOption[] = [
  {
    id: "none",
    name: "原图高清",
    nameEn: "HD Clear",
    badge: "CRISP",
    desc: "极致清晰度，自然纯净肤色",
    cssFilter: "contrast(1.05) brightness(1.02)",
  },
  {
    id: "haru",
    name: "韩国晴空蓝",
    nameEn: "Haru Blue",
    badge: "TRENDING",
    desc: "韩国超火冷白皮蓝调，清透高级",
    cssFilter: "contrast(1.08) brightness(1.06) saturate(1.05) hue-rotate(-10deg)",
  },
  {
    id: "polaroid",
    name: "拍立得 600",
    nameEn: "Polaroid 600",
    badge: "RETRO",
    desc: "经典即时相纸显影质感，青绿暗部",
    cssFilter: "contrast(1.12) sepia(0.18) saturate(1.15) brightness(1.02)",
  },
  {
    id: "hk",
    name: "港风电影",
    nameEn: "HK Cinema",
    badge: "FILM",
    desc: "浓郁复古王家卫胶片感，暖金泛绿",
    cssFilter: "contrast(1.18) saturate(1.22) sepia(0.24) hue-rotate(5deg)",
  },
  {
    id: "glam",
    name: "梦幻奶油光",
    nameEn: "Soft Glam",
    badge: "CREAM",
    desc: "日系柔光奶油肌，朦胧浪漫高光",
    cssFilter: "contrast(1.08) brightness(1.12) saturate(1.1)",
  },
  {
    id: "fisheye",
    name: "趣味大鱼眼",
    nameEn: "Y2K Fisheye",
    badge: "FUNKY",
    desc: "千禧年超广角趣味凸透镜，搞怪出片",
    cssFilter: "contrast(1.15) saturate(1.2)",
  },
  {
    id: "cyber",
    name: "霓虹赛博",
    nameEn: "Neon Cyber",
    badge: "POP",
    desc: "电光紫粉与青色双色调冲击感",
    cssFilter: "contrast(1.3) hue-rotate(280deg) saturate(1.35)",
  },
  {
    id: "bw",
    name: "经典银盐黑白",
    nameEn: "Silver B&W",
    badge: "B&W",
    desc: "高反差黑白影调，情绪张力十足",
    cssFilter: "grayscale(1) contrast(1.4) brightness(1.02)",
  },
  {
    id: "grain",
    name: "复古颗粒",
    nameEn: "35mm Grain",
    badge: "ANALOG",
    desc: "细腻真实的 35mm 胶卷颗粒感",
    cssFilter: "contrast(1.12) brightness(1.02) sepia(0.12)",
  },
  {
    id: "pixel",
    name: "8-Bit 像素",
    nameEn: "8-Bit Pixel",
    badge: "PIXEL",
    desc: "怀旧千禧掌机马赛克像素画风",
    cssFilter: "contrast(1.25) saturate(1.2)",
  },
];

/**
 * High-clarity subtle unsharp masking to enhance eyes, hair, and edges
 */
export function enhanceSharpness(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  // Lightweight 3x3 unsharp mask kernel:
  // [  0, -0.5,  0 ]
  // [ -0.5,  3, -0.5 ]
  // [  0, -0.5,  0 ]
  const copy = new Uint8ClampedArray(data);
  const amount = 0.28; // Subtle edge enhancement without noise amplification

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const up = ((y - 1) * width + x) * 4;
      const down = ((y + 1) * width + x) * 4;
      const left = (y * width + (x - 1)) * 4;
      const right = (y * width + (x + 1)) * 4;

      for (let c = 0; c < 3; c++) {
        const val = copy[idx + c];
        const neighbors = (copy[up + c] + copy[down + c] + copy[left + c] + copy[right + c]) * 0.25;
        const sharpened = val + (val - neighbors) * amount;
        data[idx + c] = Math.min(255, Math.max(0, sharpened));
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Apply real-time / captured barrel distortion for Y2K Fisheye lens
 */
function applyFisheyeDistortion(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const src = ctx.getImageData(0, 0, width, height);
  const dst = ctx.createImageData(width, height);
  const sData = src.data;
  const dData = dst.data;

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.sqrt(cx * cx + cy * cy);
  const strength = 1.65; // Fisheye curve intensity

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        const normDist = dist / radius;
        // Barrel distortion map
        const r = Math.pow(normDist, strength);
        const theta = Math.atan2(dy, dx);

        const srcX = Math.round(cx + r * radius * Math.cos(theta));
        const srcY = Math.round(cy + r * radius * Math.sin(theta));

        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          const dIdx = (y * width + x) * 4;
          const sIdx = (srcY * width + srcX) * 4;
          dData[dIdx] = sData[sIdx];
          dData[dIdx + 1] = sData[sIdx + 1];
          dData[dIdx + 2] = sData[sIdx + 2];
          dData[dIdx + 3] = sData[sIdx + 3];
        }
      }
    }
  }
  ctx.putImageData(dst, 0, 0);
}

/**
 * Apply the selected filter, film grain, pixelation, fisheye, and aperture effect onto a canvas
 */
export function applyFilterToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  filterId: FilterId,
  apertureValue: number
) {
  // 1. Fisheye Lens Distortion
  if (filterId === "fisheye") {
    applyFisheyeDistortion(ctx, width, height);
  }

  // 2. Pixelation filter
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

  // 3. Film Grain filter (fine-grained analog grain)
  if (filterId === "grain") {
    const grainImg = ctx.getImageData(0, 0, width, height);
    const d = grainImg.data;
    const intensity = 28;

    for (let i = 0; i < d.length; i += 4) {
      const noise = (Math.random() - 0.5) * intensity;
      d[i] = Math.min(255, Math.max(0, d[i] + noise));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise));
    }
    ctx.putImageData(grainImg, 0, 0);
  }

  // 4. Black and white filter
  if (filterId === "bw") {
    const bwImg = ctx.getImageData(0, 0, width, height);
    const d = bwImg.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const contrast = 1.35;
      const adjusted = Math.min(255, Math.max(0, (gray - 128) * contrast + 128));
      d[i] = adjusted;
      d[i + 1] = adjusted;
      d[i + 2] = adjusted;
    }
    ctx.putImageData(bwImg, 0, 0);
  }

  // 5. Haru Sky Blue tinting (cool highlights, clean skin tone)
  if (filterId === "haru") {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      // Slightly lift blues and reduce red cast in midtones
      d[i] = Math.max(0, d[i] * 0.96); // Red
      d[i + 1] = Math.min(255, d[i + 1] * 1.02); // Green
      d[i + 2] = Math.min(255, d[i + 2] * 1.08 + 4); // Blue
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // 6. Aperture Depth-of-Field Soft Focus & Vignette
  if (apertureValue < 8) {
    const maxAperture = 1.4;
    const factor = Math.max(0, (8 - apertureValue) / (8 - maxAperture));

    ctx.save();
    const cx = width / 2;
    const cy = height / 2;
    const innerR = Math.min(width, height) * (0.38 + (1 - factor) * 0.22);
    const outerR = Math.max(width, height) * 0.72;

    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${(factor * 0.32).toFixed(2)})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // 7. Enhance sharpness for crystal clarity (except on pixel or soft glam)
  if (filterId !== "pixel" && filterId !== "glam") {
    enhanceSharpness(ctx, width, height);
  }
}
