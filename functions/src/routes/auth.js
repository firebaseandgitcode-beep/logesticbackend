const router = require('express').Router()
const bcrypt = require('bcrypt')
const { db } = require('../lib/admin')
const { signUserToken } = require('../lib/jwt')

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

module.exports = router
