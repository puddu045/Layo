import * as ImageManipulator from 'expo-image-manipulator';

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** Crops `uri` to `rect` (in the original image's own pixel coordinates) and resizes the result
 * to `outputWidth`, keeping `rect`'s aspect ratio. Native implementation — see `crop-image.web.ts`
 * for why this needs one. */
export async function cropImage(uri: string, rect: CropRect, outputWidth: number): Promise<{ uri: string }> {
  const outputHeight = Math.round(outputWidth * (rect.height / rect.width));
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: rect }, { resize: { width: outputWidth, height: outputHeight } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: result.uri };
}
