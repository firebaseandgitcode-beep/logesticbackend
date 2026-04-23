const router = require('express').Router()
const bcrypt = require('bcrypt')
const { db } = require('../lib/admin')
const verifyToken = require('../middleware/verifyToken')

router.use(verifyToken)

// Only business owners (role='user') can manage staff
router.use((req, res, next) => {
  if (req.user.role === 'staff') {
    return res.status(403).json({ error: 'Only business owners can manage staff' })
  }
  next()
})

// GET /management
router.get('/', async (req, res) => {
  try {
    const snap = await db.collection('management')
      .where('userId', '==', req.userId)
      .get()

    const staff = snap.docs.map(doc => {
      const data = doc.data()
      delete data.passwordHash
      return { id: doc.id, ...data }
    })

    return res.json({ staff })
  } catch (err) {
    console.error('management GET error:', err)
    return res.status(500).json({ error: 'Failed to fetch staff.' })
  }
})

// POST /management
router.post('/', async (req, res) => {
  try {
    const { username, password, name, jobs } = req.body

    if (!username || !password || !name || !jobs) {
      return res.status(400).json({ error: 'username, password, name, and jobs are required' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ error: 'jobs must be a non-empty array' })
    }

    const normalizedUsername = username.toLowerCase().trim()

    // Check username uniqueness globally
    const usernameCheck = await db.collection('management')
      .where('username', '==', normalizedUsername)
      .limit(1)
      .get()

    if (!usernameCheck.empty) {
      return res.status(409).json({ error: 'Username is already taken' })
    }

    // Generate managerId
    const countSnap = await db.collection('management')
      .where('userId', '==', req.userId)
      .get()
    const count = countSnap.size + 1
    const managerId = `MGR${String(count).padStart(3, '0')}`

    const passwordHash = await bcrypt.hash(password, 10)
    const now = new Date().toISOString()

    const data = {
      ...req.body,
      username: normalizedUsername,
      managerId,
      passwordHash,
      userId: req.userId,
      status: req.body.status || 'active',
      createdAt: now,
      updatedAt: now,
    }

    const ref = await db.collection('management').add(data)

    const responseData = { ...data }
    delete responseData.passwordHash

    return res.status(201).json({ staff: { id: ref.id, ...responseData } })
  } catch (err) {
    console.error('management POST error:', err)
    return res.status(500).json({ error: 'Failed to create staff member.' })
  }
})

// PUT /management/:id
router.put('/:id', async (req, res) => {
  try {
    const ref = db.collection('management').doc(req.params.id)
    const doc = await ref.get()

    if (!doc.exists) return res.status(404).json({ error: 'Staff member not found' })
    if (doc.data().userId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    const ALLOWED_FIELDS = ['name', 'email', 'phone', 'role', 'customRole', 'jobs', 'username', 'avatar', 'bankDetails', 'status']

    const updates = { updatedAt: new Date().toISOString() }
    for (const field of ALLOWED_FIELDS) {
      if (field in req.body) {
        updates[field] = field === 'username' ? req.body[field].toLowerCase().trim() : req.body[field]
      }
    }

    if (req.body.password) {
      updates.passwordHash = await bcrypt.hash(req.body.password, 10)
    }

    await ref.update(updates)
    const updated = await ref.get()
    const data = updated.data()
    delete data.passwordHash

    return res.json({ staff: { id: updated.id, ...data } })
  } catch (err) {
    console.error('management PUT error:', err)
    return res.status(500).json({ error: 'Failed to update staff member.' })
  }
})

// DELETE /management/:id
router.delete('/:id', async (req, res) => {
  try {
    const ref = db.collection('management').doc(req.params.id)
    const doc = await ref.get()

    if (!doc.exists) return res.status(404).json({ error: 'Staff member not found' })
    if (doc.data().userId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    await ref.delete()
    return res.json({ message: 'Staff member deleted' })
  } catch (err) {
    console.error('management DELETE error:', err)
    return res.status(500).json({ error: 'Failed to delete staff member.' })
  }
})

module.exports = router
