const router = require('express').Router()
const { db } = require('../lib/admin')
const verifyToken = require('../middleware/verifyToken')

router.use(verifyToken)

function calcStatus(fields) {
  const {
    verifiedManage,
    verifiedTripDetails,
    verifiedFuelDetails,
    verifiedCreate,
    fuelVerified,
  } = fields

  if (verifiedManage && verifiedTripDetails && verifiedFuelDetails && verifiedCreate && fuelVerified) {
    return 'completed'
  }
  if (verifiedCreate) return 'in_progress'
  return 'planned'
}

// GET /trips
router.get('/', async (req, res) => {
  try {
    const snap = await db.collection('trips')
      .where('userId', '==', req.userId)
      .orderBy('createdAt', 'desc')
      .get()

    const trips = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return res.json({ trips })
  } catch (err) {
    console.error('trips GET error:', err)
    return res.status(500).json({ error: 'Failed to fetch trips.' })
  }
})

// POST /trips
router.post('/', async (req, res) => {
  try {
    const now = new Date().toISOString()
    const data = {
      ...req.body,
      userId: req.userId,
      createdBy: req.user.managerId || null,
      createdByName: req.user.name || null,
      status: calcStatus(req.body),
      createdAt: now,
      updatedAt: now,
    }

    const ref = await db.collection('trips').add(data)
    const trip = { id: ref.id, ...data }

    return res.status(201).json({ trip })
  } catch (err) {
    console.error('trips POST error:', err)
    return res.status(500).json({ error: 'Failed to create trip.' })
  }
})

// PUT /trips/:id
router.put('/:id', async (req, res) => {
  try {
    const ref = db.collection('trips').doc(req.params.id)
    const doc = await ref.get()

    if (!doc.exists) return res.status(404).json({ error: 'Trip not found' })
    if (doc.data().userId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    const merged = { ...doc.data(), ...req.body }
    const updates = {
      ...req.body,
      status: calcStatus(merged),
      updatedAt: new Date().toISOString(),
    }
    delete updates.userId
    delete updates.createdAt

    await ref.update(updates)
    const updated = await ref.get()
    const trip = { id: updated.id, ...updated.data() }

    return res.json({ trip })
  } catch (err) {
    console.error('trips PUT error:', err)
    return res.status(500).json({ error: 'Failed to update trip.' })
  }
})

// DELETE /trips/:id
router.delete('/:id', async (req, res) => {
  try {
    const ref = db.collection('trips').doc(req.params.id)
    const doc = await ref.get()

    if (!doc.exists) return res.status(404).json({ error: 'Trip not found' })
    if (doc.data().userId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    await ref.delete()
    return res.json({ message: 'Trip deleted' })
  } catch (err) {
    console.error('trips DELETE error:', err)
    return res.status(500).json({ error: 'Failed to delete trip.' })
  }
})

module.exports = router
