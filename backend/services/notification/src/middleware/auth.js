const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET is not set');
}

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token required' });
  }
  try {
    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    req.user = {
      id: decoded.userId || decoded.id || decoded.patientId || decoded.doctorId,
      patientId: decoded.patientId || (decoded.role === 'patient' ? decoded.userId : undefined),
      doctorId: decoded.doctorId || (decoded.role === 'doctor' ? decoded.userId : undefined),
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: `Forbidden. Required role: ${roles.join(' | ')}.` });
  }
  next();
};

module.exports = { auth, requireRole };
