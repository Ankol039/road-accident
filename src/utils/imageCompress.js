/**
 * Shrink a photo in the browser before storing it in Firestore.
 *
 * The PHP app used GD (api/core/images.php). On the Spark plan we cannot use
 * Cloud Functions or Storage, so we compress in the browser with a canvas and
 * store the bytes inside a Firestore document (each must stay under ~1 MB).
 *
 * Mirrors the PHP rules: longest side <= 1280px, JPEG quality 0.72, target
 * under 900 KB, iterating quality/size down until it fits.
 */
import { PHOTO_MAX_SIDE_PX, PHOTO_JPEG_QUALITY, MAX_STORED_KB } from '../lib/constants.js'

/** Load a File into an HTMLImageElement. */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

/** Draw the image to a canvas at (up to) the given longest side. */
function drawToCanvas(img, maxSide) {
  let { width, height } = img
  const scale = Math.min(1, maxSide / Math.max(width, height))
  width = Math.round(width * scale)
  height = Math.round(height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)
  return canvas
}

const canvasToBlob = (canvas, quality) =>
  new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality),
  )

/**
 * Compress one File. Resolves { blob, width, height, name, sizeBytes }.
 * Throws when even the smallest attempt is bigger than MAX_STORED_KB.
 */
export async function compressPhoto(file) {
  const img = await loadImage(file)
  let maxSide = PHOTO_MAX_SIDE_PX
  let quality = PHOTO_JPEG_QUALITY
  let canvas = drawToCanvas(img, maxSide)
  let blob = await canvasToBlob(canvas, quality)

  const limitBytes = MAX_STORED_KB * 1024
  // Try smaller quality, then smaller dimensions, until it fits.
  for (let attempt = 0; attempt < 8 && blob && blob.size > limitBytes; attempt += 1) {
    if (quality > 0.4) quality -= 0.1
    else maxSide = Math.round(maxSide * 0.85)
    canvas = drawToCanvas(img, maxSide)
    blob = await canvasToBlob(canvas, quality)
  }

  if (!blob) throw new Error('Could not compress that image')
  if (blob.size > limitBytes) {
    throw new Error(`Photo is still too large after shrinking (${Math.round(blob.size / 1024)} KB)`)
  }

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    name: file.name,
    sizeBytes: blob.size,
  }
}

/** Blob -> base64 string (for storage inside Firestore; stripped of the data: prefix). */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('Could not read the compressed photo'))
    reader.readAsDataURL(blob)
  })
}

/** base64 string + mime -> object URL for display. */
export function base64ToObjectUrl(base64, mime = 'image/jpeg') {
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i)
  return URL.createObjectURL(new Blob([arr], { type: mime }))
}
