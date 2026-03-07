/**
 * Client-side image cropping + resizing utility.
 * Takes a source image URL and crop area, returns a compressed square image.
 */

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

const MAX_SIZE = 512
const JPEG_QUALITY = 0.85

/**
 * Crop and resize an image to a square JPEG, ready for upload.
 * Always outputs at most MAX_SIZE x MAX_SIZE pixels.
 */
export async function cropImage(
  imageSrc: string,
  cropArea: CropArea,
): Promise<{ file: File; dataUrl: string }> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')

  // Output size: min of crop size and MAX_SIZE
  const outputSize = Math.min(cropArea.width, MAX_SIZE)
  canvas.width = outputSize
  canvas.height = outputSize

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')

  // Draw the cropped region scaled to output size
  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outputSize,
    outputSize,
  )

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })

  const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
  return { file, dataUrl }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
