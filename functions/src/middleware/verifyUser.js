const { verifyToken } = require('../lib/jwt')

module.exports = function verifyUser(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }
  try {
    const decoded = verifyToken(auth.slice(7))
    if (decoded.role !== 'user') {
      return res.status(403).json({ error: 'Access denied' })
    }
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
