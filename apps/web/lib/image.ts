/** Center-crops an uploaded image to 1:1 and scales down to max 512×512 JPEG data URL. */
export async function cropAvatarSquare(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const outSize = Math.min(512, side);
  const sx = Math.floor((bitmap.width - side) / 2);
  const sy = Math.floor((bitmap.height - side) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, outSize, outSize);
  bitmap.close?.();

  let dataUrl = canvas.toDataURL('image/webp', 0.85);
  if (!dataUrl.startsWith('data:image/webp')) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  }
  return dataUrl;
}
