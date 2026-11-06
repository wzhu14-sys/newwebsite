export interface PaperTheme {
  id: string;
  name: string;
  bgColor: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  accentDot: string;
}

export const PAPER_THEMES: PaperTheme[] = [
  {
    id: "fresh-mint",
    name: "Fresh Mint",
    bgColor: "#E6FBF5",
    textColor: "#064E3B",
    subtextColor: "#059669",
    borderColor: "#A7F3D0",
    accentDot: "#10B981",
  },
  {
    id: "classic-white",
    name: "Classic White",
    bgColor: "#FFFFFF",
    textColor: "#111827",
    subtextColor: "#6B7280",
    borderColor: "#E5E7EB",
    accentDot: "#10B981",
  },
  {
    id: "noir-black",
    name: "Noir Black",
    bgColor: "#121212",
    textColor: "#FFFFFF",
    subtextColor: "#9CA3AF",
    borderColor: "#262626",
    accentDot: "#34D399",
  },
  {
    id: "pastel-pink",
    name: "Sweet Sakura",
    bgColor: "#FEE2E2",
    textColor: "#881337",
    subtextColor: "#BE123C",
    borderColor: "#FECDD3",
    accentDot: "#FB7185",
  },
  {
    id: "y2k-silver",
    name: "Y2K Chrome",
    bgColor: "#E2E8F0",
    textColor: "#0F172A",
    subtextColor: "#475569",
    borderColor: "#CBD5E1",
    accentDot: "#38BDF8",
  },
  {
    id: "butter-cream",
    name: "Butter Cream",
    bgColor: "#FEF3C7",
    textColor: "#78350F",
    subtextColor: "#B45309",
    borderColor: "#FDE68A",
    accentDot: "#F59E0B",
  },
  {
    id: "lavender",
    name: "Lavender Mist",
    bgColor: "#EDE9FE",
    textColor: "#4C1D95",
    subtextColor: "#6D28D9",
    borderColor: "#DDD6FE",
    accentDot: "#A855F7",
  },
];

export interface PhotoStripOptions {
  themeId?: string;
  doodleCanvas?: HTMLCanvasElement | null;
  date?: Date;
}

/**
 * Generates ultra-high resolution (1200px wide Retina) photo strip
 */
export async function createPhotoStrip(
  images: string[],
  options: PhotoStripOptions = {}
): Promise<{ dataUrl: string; blob: Blob }> {
  const {
    themeId = "fresh-mint",
    doodleCanvas = null,
    date = new Date(),
  } = options;

  const theme =
    PAPER_THEMES.find((t) => t.id === themeId) || PAPER_THEMES[0];

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create canvas context");

  // Ultra-HD Retina Strip Layout (1200px width for razor-sharp photos)
  const stripWidth = 1200;
  const marginX = 72;
  const marginTop = 76;
  const photoGap = 48;
  const photoWidth = stripWidth - marginX * 2; // 1056px
  const photoHeight = Math.round(photoWidth * 0.75); // 792px (4:3)
  const footerHeight = 320;

  const totalHeight =
    marginTop +
    images.length * photoHeight +
    (images.length - 1) * photoGap +
    footerHeight;

  canvas.width = stripWidth;
  canvas.height = totalHeight;

  // Maximize rendering quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1. Draw solid paper background
  ctx.fillStyle = theme.bgColor;
  ctx.fillRect(0, 0, stripWidth, totalHeight);

  // 2. Outer border
  ctx.strokeStyle = theme.borderColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, stripWidth - 4, totalHeight - 4);

  // 3. Draw each high-res photo
  for (let i = 0; i < images.length; i++) {
    const img = await loadImage(images[i]);
    const y = marginTop + i * (photoHeight + photoGap);

    const imgAspect = img.width / img.height;
    const targetAspect = photoWidth / photoHeight;

    let sx = 0,
      sy = 0,
      sw = img.width,
      sh = img.height;

    if (imgAspect > targetAspect) {
      sw = img.height * targetAspect;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / targetAspect;
      sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, marginX, y, photoWidth, photoHeight);

    // Frame border around each photo
    ctx.strokeStyle = "rgba(0, 0, 0, 0.14)";
    ctx.lineWidth = 2;
    ctx.strokeRect(marginX, y, photoWidth, photoHeight);
  }

  // 4. Footer branding
  const footerStartY =
    marginTop +
    images.length * photoHeight +
    (images.length - 1) * photoGap +
    54;

  ctx.fillStyle = theme.textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "800 40px -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
  ctx.letterSpacing = "8px";
  ctx.fillText("LIFE 4 CUTS  ✦  PHOTO BOOTH", stripWidth / 2, footerStartY);

  const formattedDate = date
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();

  const formattedTime = date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase();

  ctx.fillStyle = theme.subtextColor;
  ctx.font = "600 24px -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif";
  ctx.letterSpacing = "3px";
  ctx.fillText(
    `${formattedDate}  •  ${formattedTime}`,
    stripWidth / 2,
    footerStartY + 64
  );

  // Accent Dots
  const dotY = footerStartY + 128;
  const dotSpacing = 32;
  const startDotX = stripWidth / 2 - (3 * dotSpacing) / 2;
  for (let d = 0; d < 4; d++) {
    ctx.beginPath();
    ctx.arc(startDotX + d * dotSpacing, dotY, 6, 0, Math.PI * 2);
    ctx.fillStyle = theme.accentDot;
    ctx.fill();
  }

  // 5. Composite Doodle / Signature layer
  if (doodleCanvas) {
    ctx.drawImage(doodleCanvas, 0, 0, stripWidth, totalHeight);
  }

  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });

  return { dataUrl, blob };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
