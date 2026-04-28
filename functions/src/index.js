const { onRequest } = require('firebase-functions/v2/https')
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcrypt')
const { db } = require('./lib/admin')

const app = express()

const ALLOWED_ORIGINS = [
  'https://mylogestic1.web.app',
  'https://mylogestic1.firebaseapp.com',
  'https://mylogestic1-admin.web.app',
  'https://mylogestic1-admin.firebaseapp.com',
  'https://mylogestic1-app.web.app',
  'https://mylogestic1-app.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8081',
  'http://localhost:19006',
]

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

app.use('/auth', require('./routes/auth'))
app.use('/admin', require('./routes/admin'))
app.use('/upload', require('./routes/upload'))
app.use('/vehicles', require('./routes/vehicles'))
app.use('/drivers', require('./routes/drivers'))
app.use('/trips', require('./routes/trips'))
app.use('/management', require('./routes/management'))
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))
app.use((_, res) => res.status(404).json({ error: 'Not found' }))

// ─── Seed default admin on first cold start (v2) ─────────────────────────────
async function seedDefaultAdmin() {
  try {
    const snap = await db.collection('admins').limit(1).get()
    if (!snap.empty) return
    const passwordHash = await bcrypt.hash('Admin@2026', 10)
    await db.collection('admins').doc('default-admin').set({
      username: 'mylogestic',
      displayName: 'mylogestic Admin',
      passwordHash,
      isSuperAdmin: true,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: null,
      createdByName: 'System',
    })
    console.log('Default admin seeded → username: mylogestic  password: Admin@2026')
  } catch (err) {
    console.error('Seed error:', err)
  }
}

seedDefaultAdmin()

// Export the raw Express app for local dev server
module.exports.app = app

// Firebase Function export
exports.api = onRequest(
  { region: 'us-central1', timeoutSeconds: 60, memory: '256MiB', invoker: 'public' },
  app
)
