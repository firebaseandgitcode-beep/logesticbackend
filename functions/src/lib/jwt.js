const jwt = require('jsonwebtoken')

const secret = () => process.env.JWT_SECRET || 'logestic-dev-secret-change-in-prod'
const THIRTY_DAYS = '30d'

function signUserToken(payload) {
  return jwt.sign(
    { ...payload, role: 'user' },
    secret(),
    { expiresIn: THIRTY_DAYS }
  )
}

function signAdminToken(payload) {
  return jwt.sign(
    { ...payload, role: 'admin' },
    secret(),
    { expiresIn: THIRTY_DAYS }
  )
}

function signStaffToken(payload) {
  return jwt.sign(
    { ...payload, role: 'staff' },
    secret(),
    { expiresIn: THIRTY_DAYS }
  )
}

function verifyToken(token) {
  return jwt.verify(token, secret())
}

module.exports = { signUserToken, signAdminToken, signStaffToken, verifyToken }
