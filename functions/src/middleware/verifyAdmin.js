const { verifyToken } = require('../lib/jwt')

module.exports = function verifyAdmin(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }
  try {
    const decoded = verifyToken(auth.slice(7))
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    req.admin = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
