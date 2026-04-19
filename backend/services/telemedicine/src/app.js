const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Session = require('./models/Session');

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET is not set');
}
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;

const app = express();

if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log('[telemedicine] MongoDB connected'))
    .catch((err) => console.error('[telemedicine] MongoDB connection failed:', err.message));
} else {
  console.warn('[telemedicine] MONGO_URI not set — sessions will not persist.');
}

app.use(cors());
app.use(express.json());

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.userId || decoded.id || decoded.doctorId || decoded.patientId,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

// Session routes — persisted in MongoDB so sessions survive restarts + multiple pods.
app.post('/api/sessions', auth, async (req, res) => {
  const { appointmentId, doctorId, patientId, signalingUrl } = req.body || {};
  if (!appointmentId || !doctorId || !patientId) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  if (req.user.role !== 'admin' && req.user.id !== patientId && req.user.id !== doctorId) {
    return res.status(403).json({ message: 'Forbidden: You cannot create a session for this appointment' });
  }

  try {
    let session = await Session.findOne({ appointmentId });
    if (session) {
      if (signalingUrl) {
        session.signalingUrl = signalingUrl;
        await session.save();
      }
      return res.status(200).json(session);
    }

    session = new Session({
      appointmentId,
      doctorId,
      patientId,
      signalingUrl,
      channelName: `medsync_${appointmentId}`,
      status: 'active',
    });
    await session.save();
    return res.status(201).json(session);
  } catch (err) {
    return res.status(500).json({ message: 'Database error', error: err.message });
  }
});

app.get('/api/sessions/:appointmentId', auth, async (req, res) => {
  try {
    const session = await Session.findOne({ appointmentId: req.params.appointmentId });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (req.user.role !== 'admin' && req.user.id !== session.patientId && req.user.id !== session.doctorId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return res.json(session);
  } catch {
    return res.status(500).json({ message: 'Database error' });
  }
});

app.put('/api/sessions/:appointmentId/end', auth, async (req, res) => {
  try {
    const session = await Session.findOne({ appointmentId: req.params.appointmentId });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (req.user.role !== 'admin' && req.user.id !== session.doctorId) {
      return res.status(403).json({ message: 'Forbidden: Only the doctor can end a session' });
    }

    session.status = 'ended';
    session.endedAt = new Date();
    await session.save();
    return res.json(session);
  } catch {
    return res.status(500).json({ message: 'Database error' });
  }
});

app.get('/', (_req, res) => res.json({ service: 'Telemedicine API', status: 'running' }));
app.get('/health', (_req, res) => res.json({ ok: true }));

module.exports = app;
