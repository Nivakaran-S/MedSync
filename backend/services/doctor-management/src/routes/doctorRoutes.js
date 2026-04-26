const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET is not set');
}

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const id = decoded.userId || decoded.id || decoded.doctorId;
    req.user = {
      id,
      doctorId: decoded.doctorId || (decoded.role === 'doctor' ? id : undefined),
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

// Registration / login
router.post('/register', doctorController.registerDoctor);
router.post('/login', doctorController.login);

// Consultation fee settings
router.get('/settings/consultation-fee', doctorController.getConsultationSettings);
router.put('/settings/consultation-fee', auth, doctorController.updateConsultationSettings);

// Prescriptions — verify is public (QR scan), issue is doctor-only
router.get('/prescriptions/verify/:verificationId', doctorController.getPrescriptionByVerifyId);
router.post('/prescriptions', auth, doctorController.issuePrescription);

// Doctor lookup
router.get('/', doctorController.listDoctors);
router.get('/:id', doctorController.getDoctor);
router.put('/:id', auth, doctorController.updateDoctor);
router.get('/:id/analytics', auth, doctorController.getAnalytics);

// Availability
router.get('/:id/availability', doctorController.getAvailability);
router.post('/:id/availability', auth, doctorController.addAvailability);
router.post('/:id/availability/bulk', auth, doctorController.addAvailabilityBulk);
router.put('/:id/availability/:slotId', auth, doctorController.updateAvailability);
router.delete('/:id/availability/:slotId', auth, doctorController.deleteAvailability);

// Admin: suspend or reactivate a doctor
router.patch('/:id/status', auth, doctorController.suspendDoctor);

module.exports = router;
