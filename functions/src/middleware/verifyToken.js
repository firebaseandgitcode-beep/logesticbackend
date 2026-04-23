const { verifyToken } = require('../lib/jwt')

module.exports = function verifyTokenMiddleware(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }
  try {
    const decoded = verifyToken(auth.slice(7))
    if (decoded.role !== 'user' && decoded.role !== 'staff') {
      return res.status(403).json({ error: 'Access denied' })
    }
    req.user = decoded
    req.userId = decoded.role === 'staff' ? decoded.ownerId : decoded.uid
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
