const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const PATIENT_URL = (process.env.PATIENT_SERVICE_URL || 'http://patient-management:3001') + '/api/patients';
const DOCTOR_URL = (process.env.DOCTOR_SERVICE_URL || 'http://doctor-management:3002') + '/api/doctors';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

const issueToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRE });

const normalize = (data, role) => {
  const subject = data.patient || data.doctor || data.admin || data.user;
  if (!subject) return null;
  const email = subject.email || (subject.contact && subject.contact.email) || undefined;
  return {
    id: subject._id || subject.id,
    email: email,
    name: subject.name || `${subject.firstName || ''} ${subject.lastName || ''}`.trim() || email,
    role,
  };
};

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (admin && (await bcrypt.compare(password, admin.password))) {
      const user = { id: admin._id.toString(), email: admin.email, name: admin.name, role: 'admin' };
      return res.json({ user, token: issueToken({ userId: user.id, email: user.email, role: 'admin' }) });
    }
  } catch (err) {
    console.error('[auth] admin lookup failed:', err.message);
  }

  try {
    const { data } = await axios.post(`${DOCTOR_URL}/login`, { email, password }, { timeout: 5000 });
    const user = normalize(data, 'doctor');
    if (user) {
      return res.json({ user, token: issueToken({ userId: user.id, email: user.email, role: 'doctor' }) });
    }
  } catch (err) {
    // Surface doctor service's domain-specific 401 messages (e.g. "Your license
    // is pending approval", "Account inactive") so the user sees the real
    // reason instead of falling through to the patient login lookup.
    if (err.response?.status === 401 && err.response?.data?.message
        && /pending approval|inactive|suspended|not verified/i.test(err.response.data.message)) {
      return res.status(401).json({ message: err.response.data.message });
    }
    if (err.response && err.response.status !== 401 && err.response.status !== 404) {
      console.error('[auth] doctor login error:', err.message);
    }
  }

  try {
    const { data } = await axios.post(`${PATIENT_URL}/login`, { email, password }, { timeout: 5000 });
    const user = normalize(data, 'patient');
    if (user) {
      return res.json({ user, token: issueToken({ userId: user.id, email: user.email, role: 'patient' }) });
    }
  } catch (err) {
    if (err.response && err.response.status !== 401 && err.response.status !== 404) {
      console.error('[auth] patient login error:', err.message);
    }
  }

  return res.status(401).json({ message: 'Invalid email or password.' });
};

exports.register = async (req, res) => {
  const { role, ...payload } = req.body || {};
  if (!role || !['patient', 'doctor'].includes(role)) {
    return res.status(400).json({ message: "Field 'role' must be 'patient' or 'doctor'." });
  }
  const url = role === 'doctor' ? `${DOCTOR_URL}/register` : `${PATIENT_URL}/register`;
  try {
    const { data } = await axios.post(url, payload, { timeout: 10000 });
    const user = normalize(data, role);
    if (!user) {
      return res.status(502).json({ message: 'Registration succeeded but response was malformed.' });
    }

    // Doctors must wait for admin approval before they can log in. The
    // doctor service signals this with `requiresApproval: true`. We do NOT
    // issue a JWT in that case — the registration page is responsible for
    // showing the "pending approval" message.
    if (role === 'doctor' || data.requiresApproval) {
      return res.status(201).json({
        user,
        requiresApproval: true,
        message: data.message
          || 'Registration received. An administrator will review your license. You will be notified once approved.',
      });
    }

    return res.status(201).json({ user, token: issueToken({ userId: user.id, email: user.email, role }) });
  } catch (err) {
    const status = err.response?.status || 502;
    const message = err.response?.data?.message || 'Registration failed.';
    return res.status(status).json({ message });
  }
};

exports.verify = (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token required' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return res.json({ valid: true, user: decoded });
  } catch {
    return res.status(401).json({ valid: false, message: 'Invalid or expired token' });
  }
};

exports.getPlatformHealth = async (req, res) => {
  // Verify admin token
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token required' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  const services = [
    { name: 'patient-management', url: `${process.env.PATIENT_SERVICE_URL || 'http://patient-management:3001'}/health` },
    { name: 'doctor-management', url: `${process.env.DOCTOR_SERVICE_URL || 'http://doctor-management:3002'}/health` },
    { name: 'appointment',       url: `${process.env.APPOINTMENT_SERVICE_URL || 'http://appointment:3003'}/health` },
    { name: 'telemedicine',      url: `${process.env.TELEMEDICINE_SERVICE_URL || 'http://telemedicine:3004'}/health` },
    { name: 'payment',           url: `${process.env.PAYMENT_SERVICE_URL || 'http://payment:3005'}/health` },
    { name: 'notification',      url: `${process.env.NOTIFICATION_SERVICE_URL || 'http://notification:3006'}/health` },
    { name: 'ai-symptom-checker',url: `${process.env.AI_SERVICE_URL || 'http://ai-symptom-checker:3007'}/health` },
  ];

  const results = await Promise.allSettled(
    services.map(async (svc) => {
      const start = Date.now();
      try {
        await axios.get(svc.url, { timeout: 3000 });
        return { name: svc.name, status: 'healthy', latencyMs: Date.now() - start };
      } catch {
        return { name: svc.name, status: 'unreachable', latencyMs: Date.now() - start };
      }
    })
  );

  const health = results.map(r =>
    r.status === 'fulfilled' ? r.value : { name: 'unknown', status: 'error', latencyMs: 0 }
  );

  const allHealthy = health.every(s => s.status === 'healthy');
  res.json({
    timestamp: new Date().toISOString(),
    overall: allHealthy ? 'healthy' : 'degraded',
    services: health,
  });
};

