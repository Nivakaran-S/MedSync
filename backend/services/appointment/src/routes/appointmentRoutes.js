const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/appointmentController');
const auth = require('../middleware/auth');
const internalAuth = require('../middleware/internalAuth');
const { createAppointmentRules, updateStatusRules } = require('../middleware/validate');

// ── Public / Internal ────────────────────────────────────────────────────────

// Doctor search (proxy to doctor-management service)
router.get('/search-doctors', ctrl.searchDoctors);
router.get('/search-doctors/:id', ctrl.getDoctorDetails);

// Booked slots for a doctor (used by booking calendar)
router.get('/available-slots/:doctorId', ctrl.getBookedSlots);

// ── Protected ────────────────────────────────────────────────────────────────

// Admin: all appointments across the platform
router.get('/admin/all', auth, ctrl.listAllAppointments);

// Patient's appointments
router.get('/patient/:patientId', auth, ctrl.getPatientAppointments);

// Doctor's appointments
router.get('/doctor/:doctorId', auth, ctrl.getDoctorAppointments);

// Doctor dashboard stats
router.get('/stats/doctor/:doctorId', auth, ctrl.getDoctorStats);

// Single appointment
router.get('/:id', auth, ctrl.getAppointment);

// Book a new appointment (with validation)
router.post('/', auth, createAppointmentRules, ctrl.createAppointment);

// Admin: Get all appointments across the system
router.get('/', auth, ctrl.getAllAppointments);

// Doctor accepts/rejects; patient updates status (with validation)
router.put('/:id/status', auth, updateStatusRules, ctrl.updateStatus);

// Reschedule (patient or admin)
router.put('/:id/reschedule', auth, ctrl.rescheduleAppointment);

// ── Internal Service Call (payment service → appointment service) ───────────
// Authenticated via shared INTERNAL_API_KEY header (`x-internal-api-key`).
router.put('/:id/payment', internalAuth, ctrl.updatePaymentStatus);

// Cancel appointment
router.delete('/:id', auth, ctrl.cancelAppointment);

module.exports = router;
