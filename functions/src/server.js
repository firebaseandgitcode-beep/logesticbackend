// Local dev entry — runs the Express app on PORT without Firebase wrapper
require('dotenv').config()
const { initializeApp, getApps } = require('firebase-admin/app')
if (!getApps().length) initializeApp()

const app = require('./index').app || (() => {
  // Re-export the app from index for local server
  const express = require('express')
  const cors = require('cors')
  const a = express()
  const ALLOWED = ['http://localhost:5173','http://localhost:5174','http://localhost:8081']
  a.use(cors({ origin: ALLOWED, credentials: true }))
  a.use(express.json())
  a.use('/auth', require('./routes/auth'))
  a.use('/admin', require('./routes/admin'))
  a.get('/health', (_, res) => res.json({ status: 'ok' }))
  return a
})()

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`))
