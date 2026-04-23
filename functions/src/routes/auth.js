const router = require('express').Router()
const bcrypt = require('bcrypt')
const { db } = require('../lib/admin')
const { signUserToken, signStaffToken } = require('../lib/jwt')
const verifyToken = require('../middleware/verifyToken')

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, company, password } = req.body
    if (!name || !email || !phone || !company || !password) {
      return res.status(400).json({ error: 'All fields are required' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check for existing user
    const existing = await db.collection('users')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get()

    if (!existing.empty) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const newUser = {
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      company: company.trim(),
      passwordHash,
      status: 'pending',
      createdAt: new Date().toISOString(),
      approvedAt: null,
      approvedBy: null,
      approvedByName: null,
      suspendedAt: null,
      suspendedBy: null,
      rejectedAt: null,
      rejectedBy: null,
    }

    const ref = await db.collection('users').add(newUser)

    return res.status(201).json({
      message: 'Registration submitted. Your account is pending admin approval.',
      userId: ref.id,
    })
  } catch (err) {
    console.error('register error:', err)
    return res.status(500).json({ error: 'Registration failed. Please try again.' })
  }
})

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const snap = await db.collection('users')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get()

    if (snap.empty) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const doc = snap.docs[0]
    const user = doc.data()

    const passwordMatch = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        error: 'Your account is pending admin approval. You will be notified once approved.',
        status: 'pending',
      })
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Contact support.', status: 'suspended' })
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Your registration was not approved.', status: 'rejected' })
    }

    const token = signUserToken({
      uid: doc.id,
      email: user.email,
      name: user.name,
      company: user.company,
    })

    return res.json({
      token,
      user: {
        id: doc.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        company: user.company,
        status: user.status,
      },
    })
  } catch (err) {
    console.error('login error:', err)
    return res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

// POST /auth/staff-login
router.post('/staff-login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }

    const normalizedUsername = username.toLowerCase().trim()

    const snap = await db.collection('management')
      .where('username', '==', normalizedUsername)
      .limit(1)
      .get()

    if (snap.empty) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    const doc = snap.docs[0]
    const staff = doc.data()

    const passwordMatch = await bcrypt.compare(password, staff.passwordHash)
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    if (staff.status !== 'active') {
      return res.status(403).json({ error: 'Your account is not active. Contact your manager.', status: staff.status })
    }

    const token = signStaffToken({
      uid: doc.id,
      managerId: staff.managerId,
      ownerId: staff.userId,
      name: staff.name,
      jobs: staff.jobs,
    })

    return res.json({
      token,
      user: {
        id: doc.id,
        managerId: staff.managerId,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        customRole: staff.customRole,
        jobs: staff.jobs,
        avatar: staff.avatar,
        bankDetails: staff.bankDetails,
        status: staff.status,
        ownerId: staff.userId,
      },
    })
  } catch (err) {
    console.error('staff-login error:', err)
    return res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

// PUT /auth/profile  — update user profile (user role only)
router.put('/profile', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Only business owners can update their profile here' })
    }

    const { name, phone, company, location, avatar } = req.body
    const updates = { updatedAt: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (phone !== undefined) updates.phone = phone
    if (company !== undefined) updates.company = company
    if (location !== undefined) updates.location = location
    if (avatar !== undefined) updates.avatar = avatar

    const ref = db.collection('users').doc(req.userId)
    await ref.update(updates)
    const updated = await ref.get()
    const data = updated.data()
    delete data.passwordHash

    return res.json({ user: { id: updated.id, ...data } })
  } catch (err) {
    console.error('profile update error:', err)
    return res.status(500).json({ error: 'Failed to update profile.' })
  }
})

// PUT /auth/password  — change user password (user role only)
router.put('/password', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Only business owners can change their password here' })
    }

    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' })
    }

    const ref = db.collection('users').doc(req.userId)
    const doc = await ref.get()
    if (!doc.exists) return res.status(404).json({ error: 'User not found' })

    const user = doc.data()
    const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await ref.update({ passwordHash, updatedAt: new Date().toISOString() })

    return res.json({ message: 'Password updated' })
  } catch (err) {
    console.error('password change error:', err)
    return res.status(500).json({ error: 'Failed to update password.' })
  }
})

module.exports = router
