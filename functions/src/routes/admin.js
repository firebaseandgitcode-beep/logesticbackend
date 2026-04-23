const router = require('express').Router()
const bcrypt = require('bcrypt')
const { db } = require('../lib/admin')
const { signAdminToken } = require('../lib/jwt')
const verifyAdmin = require('../middleware/verifyAdmin')

// ─── Admin Login ──────────────────────────────────────────────────────────────

// POST /admin/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }

    const snap = await db.collection('admins')
      .where('username', '==', username.trim().toLowerCase())
      .limit(1)
      .get()

    if (snap.empty) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    const doc = snap.docs[0]
    const admin = doc.data()

    const match = await bcrypt.compare(password, admin.passwordHash)
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    if (admin.status === 'suspended') {
      return res.status(403).json({ error: 'This admin account has been suspended.' })
    }

    const token = signAdminToken({
      uid: doc.id,
      username: admin.username,
      displayName: admin.displayName,
      isSuperAdmin: admin.isSuperAdmin === true,
    })

    return res.json({
      token,
      admin: {
        id: doc.id,
        username: admin.username,
        displayName: admin.displayName,
        isSuperAdmin: admin.isSuperAdmin === true,
      },
    })
  } catch (err) {
    console.error('admin login error:', err)
    return res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

// ─── All routes below require admin JWT ──────────────────────────────────────

router.use(verifyAdmin)

// ─── Get own admin profile ────────────────────────────────────────────────────

// GET /admin/me
router.get('/me', async (req, res) => {
  try {
    const doc = await db.collection('admins').doc(req.admin.uid).get()
    if (!doc.exists) return res.status(404).json({ error: 'Admin not found' })
    const a = doc.data()
    return res.json({
      id: doc.id,
      username: a.username,
      displayName: a.displayName,
      isSuperAdmin: a.isSuperAdmin === true,
      createdAt: a.createdAt,
    })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch admin profile' })
  }
})

// ─── User management ──────────────────────────────────────────────────────────

// GET /admin/users?status=pending|active|suspended|rejected
router.get('/users', async (req, res) => {
  try {
    const { status } = req.query
    let query = db.collection('users').orderBy('createdAt', 'desc')
    if (status && ['pending', 'active', 'suspended', 'rejected'].includes(status)) {
      query = db.collection('users').where('status', '==', status).orderBy('createdAt', 'desc')
    }
    const snap = await query.get()
    const users = snap.docs.map(d => {
      const u = d.data()
      return {
        id: d.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        company: u.company,
        status: u.status,
        createdAt: u.createdAt,
        approvedAt: u.approvedAt,
        approvedBy: u.approvedBy,
        approvedByName: u.approvedByName,
        suspendedAt: u.suspendedAt,
        suspendedBy: u.suspendedBy,
        rejectedAt: u.rejectedAt,
        rejectedBy: u.rejectedBy,
      }
    })
    return res.json({ users, total: users.length })
  } catch (err) {
    console.error('get users error:', err)
    return res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// GET /admin/users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get()
    if (!doc.exists) return res.status(404).json({ error: 'User not found' })
    const u = doc.data()
    return res.json({
      id: doc.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      company: u.company,
      status: u.status,
      createdAt: u.createdAt,
      approvedAt: u.approvedAt,
      approvedBy: u.approvedBy,
      approvedByName: u.approvedByName,
      suspendedAt: u.suspendedAt,
      suspendedBy: u.suspendedBy,
    })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// PUT /admin/users/:id/approve
router.put('/users/:id/approve', async (req, res) => {
  try {
    const ref = db.collection('users').doc(req.params.id)
    const doc = await ref.get()
    if (!doc.exists) return res.status(404).json({ error: 'User not found' })
    if (doc.data().status === 'active') {
      return res.status(400).json({ error: 'User is already approved' })
    }
    await ref.update({
      status: 'active',
      approvedAt: new Date().toISOString(),
      approvedBy: req.admin.uid,
      approvedByName: req.admin.displayName,
    })
    return res.json({ message: 'User approved successfully' })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to approve user' })
  }
})

// PUT /admin/users/:id/suspend
router.put('/users/:id/suspend', async (req, res) => {
  try {
    const ref = db.collection('users').doc(req.params.id)
    const doc = await ref.get()
    if (!doc.exists) return res.status(404).json({ error: 'User not found' })
    await ref.update({
      status: 'suspended',
      suspendedAt: new Date().toISOString(),
      suspendedBy: req.admin.uid,
      suspendedByName: req.admin.displayName,
    })
    return res.json({ message: 'User suspended' })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to suspend user' })
  }
})

// PUT /admin/users/:id/reject
router.put('/users/:id/reject', async (req, res) => {
  try {
    const ref = db.collection('users').doc(req.params.id)
    const doc = await ref.get()
    if (!doc.exists) return res.status(404).json({ error: 'User not found' })
    await ref.update({
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: req.admin.uid,
      rejectedByName: req.admin.displayName,
    })
    return res.json({ message: 'User rejected' })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reject user' })
  }
})

// PUT /admin/users/:id/reactivate
router.put('/users/:id/reactivate', async (req, res) => {
  try {
    const ref = db.collection('users').doc(req.params.id)
    const doc = await ref.get()
    if (!doc.exists) return res.status(404).json({ error: 'User not found' })
    await ref.update({
      status: 'active',
      suspendedAt: null,
      suspendedBy: null,
      suspendedByName: null,
    })
    return res.json({ message: 'User reactivated' })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reactivate user' })
  }
})

// ─── Admin account management (superadmin only) ───────────────────────────────

// GET /admin/admins
router.get('/admins', async (req, res) => {
  try {
    if (!req.admin.isSuperAdmin) {
      return res.status(403).json({ error: 'Superadmin access required' })
    }
    const snap = await db.collection('admins').orderBy('createdAt', 'asc').get()
    const admins = snap.docs.map(d => {
      const a = d.data()
      return {
        id: d.id,
        username: a.username,
        displayName: a.displayName,
        isSuperAdmin: a.isSuperAdmin === true,
        status: a.status || 'active',
        createdAt: a.createdAt,
        createdByName: a.createdByName,
      }
    })
    return res.json({ admins })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch admin accounts' })
  }
})

// POST /admin/admins  — create new admin account
router.post('/admins', async (req, res) => {
  try {
    if (!req.admin.isSuperAdmin) {
      return res.status(403).json({ error: 'Superadmin access required' })
    }
    const { username, displayName, password } = req.body
    if (!username || !displayName || !password) {
      return res.status(400).json({ error: 'username, displayName, and password are required' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }
    const existing = await db.collection('admins')
      .where('username', '==', username.trim().toLowerCase())
      .limit(1)
      .get()
    if (!existing.empty) {
      return res.status(409).json({ error: 'Username already taken' })
    }
    const passwordHash = await bcrypt.hash(password, 10)
    const ref = await db.collection('admins').add({
      username: username.trim().toLowerCase(),
      displayName: displayName.trim(),
      passwordHash,
      isSuperAdmin: false,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: req.admin.uid,
      createdByName: req.admin.displayName,
    })
    return res.status(201).json({ message: 'Admin account created', id: ref.id })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create admin account' })
  }
})

// PUT /admin/admins/:id  — update password or displayName
router.put('/admins/:id', async (req, res) => {
  try {
    if (!req.admin.isSuperAdmin && req.admin.uid !== req.params.id) {
      return res.status(403).json({ error: 'You can only update your own account' })
    }
    const ref = db.collection('admins').doc(req.params.id)
    const doc = await ref.get()
    if (!doc.exists) return res.status(404).json({ error: 'Admin not found' })

    const updates = {}
    const { displayName, password, status } = req.body
    if (displayName) updates.displayName = displayName.trim()
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' })
      }
      updates.passwordHash = await bcrypt.hash(password, 10)
    }
    if (status && req.admin.isSuperAdmin) updates.status = status

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }
    await ref.update(updates)
    return res.json({ message: 'Admin account updated' })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update admin account' })
  }
})

module.exports = router
