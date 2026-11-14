export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the picked image'));
    img.src = uri;
  });
}

/** Web has no native implementation at all for `expo-image-manipulator` (no `.web.ts` in that
 * package — see `crop-image.ts`'s own comment), so this draws the crop onto a canvas instead,
 * the standard browser way to crop/resize an image. Returns a `blob:` object URL, which the
 * upload step already handles fine (it reads any picked/cropped uri via `fetch(uri)`). */
export async function cropImage(uri: string, rect: CropRect, outputWidth: number): Promise<{ uri: string }> {
  const image = await loadImage(uri);
  const outputHeight = Math.round(outputWidth * (rect.height / rect.width));

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a canvas to crop this image');

  ctx.drawImage(image, rect.originX, rect.originY, rect.width, rect.height, 0, 0, outputWidth, outputHeight);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not export the cropped image');

  return { uri: URL.createObjectURL(blob) };
}
