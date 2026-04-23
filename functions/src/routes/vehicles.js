const router = require('express').Router()
const { db } = require('../lib/admin')
const verifyToken = require('../middleware/verifyToken')

router.use(verifyToken)

// GET /vehicles
router.get('/', async (req, res) => {
  try {
    const snap = await db.collection('vehicles')
      .where('userId', '==', req.userId)
      .orderBy('createdAt', 'desc')
      .get()

    const vehicles = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return res.json({ vehicles })
  } catch (err) {
    console.error('vehicles GET error:', err)
    return res.status(500).json({ error: 'Failed to fetch vehicles.' })
  }
})

// POST /vehicles
router.post('/', async (req, res) => {
  try {
    const { vehicleNumber } = req.body
    if (!vehicleNumber) {
      return res.status(400).json({ error: 'vehicleNumber is required' })
    }

    const now = new Date().toISOString()
    const data = {
      ...req.body,
      userId: req.userId,
      createdAt: now,
      updatedAt: now,
    }

    const ref = await db.collection('vehicles').add(data)
    const vehicle = { id: ref.id, ...data }

    return res.status(201).json({ vehicle })
  } catch (err) {
    console.error('vehicles POST error:', err)
    return res.status(500).json({ error: 'Failed to create vehicle.' })
  }
})

// PUT /vehicles/:id
router.put('/:id', async (req, res) => {
  try {
    const ref = db.collection('vehicles').doc(req.params.id)
    const doc = await ref.get()

    if (!doc.exists) return res.status(404).json({ error: 'Vehicle not found' })
    if (doc.data().userId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    const updates = { ...req.body, updatedAt: new Date().toISOString() }
    // Prevent overwriting ownership fields
    delete updates.userId
    delete updates.createdAt

    await ref.update(updates)
    const updated = await ref.get()
    const vehicle = { id: updated.id, ...updated.data() }

    return res.json({ vehicle })
  } catch (err) {
    console.error('vehicles PUT error:', err)
    return res.status(500).json({ error: 'Failed to update vehicle.' })
  }
})

// DELETE /vehicles/:id
router.delete('/:id', async (req, res) => {
  try {
    const ref = db.collection('vehicles').doc(req.params.id)
    const doc = await ref.get()

    if (!doc.exists) return res.status(404).json({ error: 'Vehicle not found' })
    if (doc.data().userId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    await ref.delete()
    return res.json({ message: 'Vehicle deleted' })
  } catch (err) {
    console.error('vehicles DELETE error:', err)
    return res.status(500).json({ error: 'Failed to delete vehicle.' })
  }
})

module.exports = router
