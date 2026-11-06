/**
 * Generates a high-resolution vertical photo strip from 4 images.
 */
export async function createPhotoStrip(
  images: string[],
  date: Date = new Date()
): Promise<{ dataUrl: string; blob: Blob }> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create canvas context");

  // Strip layout dimensions (high resolution for crisp Retina display & printing)
  const stripWidth = 800;
  const marginX = 48;
  const marginTop = 52;
  const photoGap = 32;
  const photoWidth = stripWidth - marginX * 2; // 704px
  const photoHeight = Math.round(photoWidth * 0.75); // 4:3 aspect ratio -> 528px
  const footerHeight = 220;

  const totalHeight =
    marginTop +
    images.length * photoHeight +
    (images.length - 1) * photoGap +
    footerHeight;

  canvas.width = stripWidth;
  canvas.height = totalHeight;

  // 1. Draw solid white background with slight natural warmth
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, stripWidth, totalHeight);

  // 2. Draw subtle border or outer drop shadow guide
  ctx.strokeStyle = "#ECEFF1";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, stripWidth - 2, totalHeight - 2);

  // 3. Load and draw each photo
  for (let i = 0; i < images.length; i++) {
    const img = await loadImage(images[i]);
    const y = marginTop + i * (photoHeight + photoGap);

    // Calculate crop to cover 4:3 without distortion
    const imgAspect = img.width / img.height;
    const targetAspect = photoWidth / photoHeight;

    let sx = 0,
      sy = 0,
      sw = img.width,
      sh = img.height;

    if (imgAspect > targetAspect) {
      // Source image is wider than target
      sw = img.height * targetAspect;
      sx = (img.width - sw) / 2;
    } else {
      // Source image is taller than target
      sh = img.width / targetAspect;
      sy = (img.height - sh) / 2;
    }

    // Draw photo
    ctx.drawImage(img, sx, sy, sw, sh, marginX, y, photoWidth, photoHeight);

    // Subtle inner border around photo
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(marginX, y, photoWidth, photoHeight);
  }

  // 4. Draw Footer Area
  const footerStartY =
    marginTop +
    images.length * photoHeight +
    (images.length - 1) * photoGap +
    40;

  // Header Title
  ctx.fillStyle = "#111827";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "700 28px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif";
  ctx.letterSpacing = "6px";
  ctx.fillText("PHOTO BOOTH", stripWidth / 2, footerStartY);

  // Date and Time
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

  ctx.fillStyle = "#6B7280";
  ctx.font = "500 18px -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText(
    `${formattedDate}  •  ${formattedTime}`,
    stripWidth / 2,
    footerStartY + 44
  );

  // 4 Dots icon representing 4 frames
  const dotY = footerStartY + 88;
  const dotSpacing = 20;
  const startDotX = stripWidth / 2 - (3 * dotSpacing) / 2;
  for (let d = 0; d < 4; d++) {
    ctx.beginPath();
    ctx.arc(startDotX + d * dotSpacing, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#D1D5DB";
    ctx.fill();
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
