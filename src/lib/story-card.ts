const CARD_W = 1080;
const CARD_H = 1920;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Center-crop draw (CSS object-cover equivalent) */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.width / img.height;
  const canvasRatio = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;

  if (imgRatio > canvasRatio) {
    sw = img.height * canvasRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / canvasRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** Simple word-wrap text renderer. Returns next Y position. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): void {
  const words = text.split(' ');
  let line = '';
  let linesDrawn = 0;

  for (const word of words) {
    if (linesDrawn >= maxLines) break;
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
      linesDrawn++;
    } else {
      line = test;
    }
  }
  if (line && linesDrawn < maxLines) {
    // Truncate last line with ellipsis if it still overflows
    while (ctx.measureText(line + '…').width > maxWidth && line.length > 0) {
      line = line.slice(0, -1);
    }
    ctx.fillText(line + (linesDrawn > 0 || words.length > line.split(' ').length ? '…' : ''), x, y);
  }
}

/**
 * Generates a branded 9:16 story card (1080×1920) as a JPEG Blob.
 * If photoDataUrl is provided, it's used as full-bleed background.
 * If not, a dark gradient background is used instead.
 */
export async function generateStoryCard(
  stopName: string,
  notes?: string,
  photoDataUrl?: string
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;

  // --- Background ---
  if (photoDataUrl) {
    const img = await loadImage(photoDataUrl);
    drawCover(ctx, img, 0, 0, CARD_W, CARD_H);
  } else {
    const bg = ctx.createLinearGradient(0, 0, CARD_W * 0.4, CARD_H);
    bg.addColorStop(0, '#1a2a4a');
    bg.addColorStop(1, '#0d1f2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }

  // --- Bottom gradient overlay ---
  const overlay = ctx.createLinearGradient(0, CARD_H * 0.45, 0, CARD_H);
  overlay.addColorStop(0, 'rgba(0,0,0,0)');
  overlay.addColorStop(0.6, 'rgba(0,0,0,0.65)');
  overlay.addColorStop(1, 'rgba(0,0,0,0.88)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // --- Stop name ---
  const nameSize = stopName.length > 18 ? 72 : 90;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${nameSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillText(stopName.slice(0, 24) + (stopName.length > 24 ? '…' : ''), 80, CARD_H - 400);

  // --- Notes excerpt (max 2 lines) ---
  if (notes?.trim()) {
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = `46px system-ui, -apple-system, "Segoe UI", sans-serif`;
    wrapText(ctx, notes.trim(), 80, CARD_H - 300, CARD_W - 160, 64, 2);
  }

  // --- Branding ---
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `36px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillText('🗺️  myexperienceengine.com', 80, CARD_H - 90);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.92
    );
  });
}
