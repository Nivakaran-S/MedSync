const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const PATIENT_URL = process.env.PATIENT_SERVICE_URL || 'http://patient-management:3001/api/patients';
const DOCTOR_URL = process.env.DOCTOR_SERVICE_URL || 'http://doctor-management:3002/api/doctors';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

const issueToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRE });

const normalize = (data, role) => {
  const subject = data.patient || data.doctor || data.admin || data.user;
  if (!subject) return null;
  return {
    id: subject._id || subject.id,
    email: subject.email,
    name: subject.name || `${subject.firstName || ''} ${subject.lastName || ''}`.trim() || subject.email,
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
