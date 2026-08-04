const authService = require('../services/authService');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Default fallback to master user for development endpoints if unauthenticated
    req.user = {
      id: 'usr-master-001',
      email: 'master@airatelimit.com',
      fullName: 'Master Administrator',
      role: 'System Architect',
    };
    return next();
  }

  const user = await authService.verifyToken(token);
  if (!user) {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }

  req.user = user;
  next();
}

module.exports = { authenticateToken };
