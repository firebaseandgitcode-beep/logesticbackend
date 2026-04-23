const router = require('express').Router()
const { db } = require('../lib/admin')
const verifyToken = require('../middleware/verifyToken')

router.use(verifyToken)

// GET /drivers
router.get('/', async (req, res) => {
  try {
    const snap = await db.collection('drivers')
      .where('userId', '==', req.userId)
      .orderBy('createdAt', 'desc')
      .get()

    const drivers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return res.json({ drivers })
  } catch (err) {
    console.error('drivers GET error:', err)
    return res.status(500).json({ error: 'Failed to fetch drivers.' })
  }
})

// POST /drivers
router.post('/', async (req, res) => {
  try {
    const countSnap = await db.collection('drivers')
      .where('userId', '==', req.userId)
      .get()

    const count = countSnap.size + 1
    const driverId = `DRV${String(count).padStart(3, '0')}`

    const now = new Date().toISOString()
    const data = {
      ...req.body,
      driverId,
      userId: req.userId,
      createdAt: now,
      updatedAt: now,
    }

    const ref = await db.collection('drivers').add(data)
    const driver = { id: ref.id, ...data }

    return res.status(201).json({ driver })
  } catch (err) {
    console.error('drivers POST error:', err)
    return res.status(500).json({ error: 'Failed to create driver.' })
  }
})

// PUT /drivers/:id
router.put('/:id', async (req, res) => {
  try {
    const ref = db.collection('drivers').doc(req.params.id)
    const doc = await ref.get()

    if (!doc.exists) return res.status(404).json({ error: 'Driver not found' })
    if (doc.data().userId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    const prevDriver = doc.data()
    const updates = { ...req.body, updatedAt: new Date().toISOString() }
    delete updates.userId
    delete updates.createdAt
    delete updates.driverId

    // Bidirectional vehicle sync if assignedVehicle changed
    if ('assignedVehicle' in req.body && req.body.assignedVehicle !== prevDriver.assignedVehicle) {
      const batch = db.batch()

      // Clear old vehicle's assignedDriver
      if (prevDriver.assignedVehicle) {
        const oldVehicleSnap = await db.collection('vehicles')
          .where('userId', '==', req.userId)
          .where('vehicleNumber', '==', prevDriver.assignedVehicle)
          .limit(1)
          .get()
        if (!oldVehicleSnap.empty) {
          batch.update(oldVehicleSnap.docs[0].ref, { assignedDriver: null, updatedAt: new Date().toISOString() })
        }
      }

      // Set new vehicle's assignedDriver
      if (req.body.assignedVehicle) {
        const newVehicleSnap = await db.collection('vehicles')
          .where('userId', '==', req.userId)
          .where('vehicleNumber', '==', req.body.assignedVehicle)
          .limit(1)
          .get()
        if (!newVehicleSnap.empty) {
          batch.update(newVehicleSnap.docs[0].ref, { assignedDriver: prevDriver.driverId, updatedAt: new Date().toISOString() })
        }
      }

      batch.update(ref, updates)
      await batch.commit()
    } else {
      await ref.update(updates)
    }

    const updated = await ref.get()
    const driver = { id: updated.id, ...updated.data() }

    return res.json({ driver })
  } catch (err) {
    console.error('drivers PUT error:', err)
    return res.status(500).json({ error: 'Failed to update driver.' })
  }
})

// DELETE /drivers/:id
router.delete('/:id', async (req, res) => {
  try {
    const ref = db.collection('drivers').doc(req.params.id)
    const doc = await ref.get()

    if (!doc.exists) return res.status(404).json({ error: 'Driver not found' })
    if (doc.data().userId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    const driver = doc.data()

    // Clear assigned vehicle's assignedDriver field
    if (driver.assignedVehicle) {
      const vehicleSnap = await db.collection('vehicles')
        .where('userId', '==', req.userId)
        .where('vehicleNumber', '==', driver.assignedVehicle)
        .limit(1)
        .get()
      if (!vehicleSnap.empty) {
        await vehicleSnap.docs[0].ref.update({ assignedDriver: null, updatedAt: new Date().toISOString() })
      }
    }

    await ref.delete()
    return res.json({ message: 'Driver deleted' })
  } catch (err) {
    console.error('drivers DELETE error:', err)
    return res.status(500).json({ error: 'Failed to delete driver.' })
  }
})

module.exports = router
