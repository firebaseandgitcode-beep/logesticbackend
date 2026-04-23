const { getStorage } = require('firebase-admin/storage')

/**
 * Upload a base64 data URL to Firebase Storage.
 * @param {string} base64DataUrl  e.g. "data:image/jpeg;base64,/9j/..."
 * @param {string} storagePath    destination path inside the bucket
 * @returns {Promise<string>}     public URL
 */
async function uploadBase64(base64DataUrl, storagePath) {
  const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!matches) throw new Error('Invalid base64 data URL')

  const mimeType = matches[1]
  const buffer = Buffer.from(matches[2], 'base64')

  const bucket = getStorage().bucket()
  const file = bucket.file(storagePath)

  await file.save(buffer, {
    metadata: { contentType: mimeType },
    predefinedAcl: 'publicRead',
  })

  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
}

/**
 * Delete a file from Firebase Storage by its public URL.
 * @param {string} url  public URL returned by uploadBase64
 */
async function deleteByUrl(url) {
  // URL format: https://storage.googleapis.com/{bucket}/{path}
  const match = url.match(/^https:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/)
  if (!match) throw new Error('Invalid storage URL')

  const storagePath = match[1]
  const bucket = getStorage().bucket()
  await bucket.file(storagePath).delete()
}

module.exports = { uploadBase64, deleteByUrl }
