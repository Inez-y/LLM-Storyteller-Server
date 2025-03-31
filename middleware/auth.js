// Middleware to keep tracking id
import * as verify from 'jsonwebtoken';

export function authenticateToken(req, res, next) {
  const token = req.cookies['auth-token'];
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = verify(token, SECRET_KEY);
    req.user = decoded; // decoded contains: { id, username }
    next();
  } catch (err) {
    console.error('Invalid token:', err);
    res.status(403).json({ error: 'Invalid token' });
  }
}
