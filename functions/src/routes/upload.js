const router = require('express').Router()
const verifyToken = require('../middleware/verifyToken')
const { uploadBase64 } = require('../lib/storage')

router.use(verifyToken)

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
}

// POST /upload
// body: { data: "data:image/jpeg;base64,...", folder: "vehicles" }
router.post('/', async (req, res) => {
  try {
    const { data, folder } = req.body

    if (!data || !data.startsWith('data:')) {
      return res.status(400).json({ error: 'Invalid or missing data field. Must be a base64 data URL.' })
    }

    // Extract mime type for extension
    const mimeMatch = data.match(/^data:([^;]+);base64,/)
    const mimeType = mimeMatch ? mimeMatch[1] : ''
    const ext = MIME_TO_EXT[mimeType] || '.bin'

    const safeFolder = folder || 'misc'
    const storagePath = `users/${req.userId}/${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`

    const url = await uploadBase64(data, storagePath)

    return res.status(201).json({ url })
  } catch (err) {
    console.error('upload error:', err)
    return res.status(500).json({ error: 'Upload failed. Please try again.' })
  }
})

module.exports = router
