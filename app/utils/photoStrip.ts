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
    id: "classic-white",
    name: "纯白物语",
    bgColor: "#FFFFFF",
    textColor: "#111827",
    subtextColor: "#6B7280",
    borderColor: "#E5E7EB",
    accentDot: "#D1D5DB",
  },
  {
    id: "noir-black",
    name: "暗夜黑潮",
    bgColor: "#121212",
    textColor: "#FFFFFF",
    subtextColor: "#9CA3AF",
    borderColor: "#262626",
    accentDot: "#E11D48",
  },
  {
    id: "pastel-pink",
    name: "甜心粉樱",
    bgColor: "#FEE2E2",
    textColor: "#881337",
    subtextColor: "#BE123C",
    borderColor: "#FECDD3",
    accentDot: "#FB7185",
  },
  {
    id: "y2k-silver",
    name: "千禧银灰",
    bgColor: "#E2E8F0",
    textColor: "#0F172A",
    subtextColor: "#475569",
    borderColor: "#CBD5E1",
    accentDot: "#38BDF8",
  },
  {
    id: "butter-cream",
    name: "复古奶油",
    bgColor: "#FEF3C7",
    textColor: "#78350F",
    subtextColor: "#B45309",
    borderColor: "#FDE68A",
    accentDot: "#F59E0B",
  },
  {
    id: "lavender",
    name: "浪漫香芋",
    bgColor: "#EDE9FE",
    textColor: "#4C1D95",
    subtextColor: "#6D28D9",
    borderColor: "#DDD6FE",
    accentDot: "#A855F7",
  },
  {
    id: "matcha-green",
    name: "清爽抹茶",
    bgColor: "#DCFCE7",
    textColor: "#14532D",
    subtextColor: "#15803D",
    borderColor: "#BBF7D0",
    accentDot: "#22C55E",
  },
];

export interface PhotoStripOptions {
  themeId?: string;
  doodleCanvas?: HTMLCanvasElement | null;
  date?: Date;
}

/**
 * Generates high-res vertical photo strip with customizable paper theme and doodle overlay
 */
export async function createPhotoStrip(
  images: string[],
  options: PhotoStripOptions = {}
): Promise<{ dataUrl: string; blob: Blob }> {
  const {
    themeId = "classic-white",
    doodleCanvas = null,
    date = new Date(),
  } = options;

  const theme =
    PAPER_THEMES.find((t) => t.id === themeId) || PAPER_THEMES[0];

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create canvas context");

  // High resolution dimensions
  const stripWidth = 800;
  const marginX = 48;
  const marginTop = 50;
  const photoGap = 32;
  const photoWidth = stripWidth - marginX * 2; // 704px
  const photoHeight = Math.round(photoWidth * 0.75); // 528px (4:3)
  const footerHeight = 220;

  const totalHeight =
    marginTop +
    images.length * photoHeight +
    (images.length - 1) * photoGap +
    footerHeight;

  canvas.width = stripWidth;
  canvas.height = totalHeight;

  // 1. Draw solid paper background
  ctx.fillStyle = theme.bgColor;
  ctx.fillRect(0, 0, stripWidth, totalHeight);

  // 2. Draw outer border
  ctx.strokeStyle = theme.borderColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, stripWidth - 3, totalHeight - 3);

  // 3. Draw each photo
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

    // Frame border around photo
    ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(marginX, y, photoWidth, photoHeight);
  }

  // 4. Footer: Purikura / Life4Cuts style typography
  const footerStartY =
    marginTop +
    images.length * photoHeight +
    (images.length - 1) * photoGap +
    38;

  // Header Title
  ctx.fillStyle = theme.textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "800 28px -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
  ctx.letterSpacing = "6px";
  ctx.fillText("LIFE 4 CUTS  ✦  PHOTO BOOTH", stripWidth / 2, footerStartY);

  // Date and Time stamp
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
  ctx.font = "600 17px -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText(
    `${formattedDate}  •  ${formattedTime}`,
    stripWidth / 2,
    footerStartY + 46
  );

  // Accent Dots / Hearts
  const dotY = footerStartY + 92;
  const dotSpacing = 24;
  const startDotX = stripWidth / 2 - (3 * dotSpacing) / 2;
  for (let d = 0; d < 4; d++) {
    ctx.beginPath();
    ctx.arc(startDotX + d * dotSpacing, dotY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = theme.accentDot;
    ctx.fill();
  }

  // 5. Composite Hand-written Doodle / Signature Canvas on top
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
