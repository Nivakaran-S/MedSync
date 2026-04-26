const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const { createCheckoutRules } = require('../middleware/validate');

// ── Stripe Webhook ─────────────────────────────────────────────────────────
// IMPORTANT: must use raw body — declared in app.js before json middleware
router.post('/webhook', ctrl.handleWebhook);

// ── Protected Routes ───────────────────────────────────────────────────────
// Create a Stripe Checkout session for an appointment
router.post('/checkout', auth, createCheckoutRules, ctrl.createCheckoutSession);
router.post('/confirm-session', auth, ctrl.confirmCheckoutSession);

// Admin: all payments + revenue summary (must come before `/:appointmentId`)
router.get('/admin/all', auth, ctrl.listAllPayments);
router.get('/admin/report/pdf', auth, ctrl.getRevenueReportPdf);

// Public verification endpoint for tamper-evident receipt hash
router.get('/verify/:receiptHash', ctrl.verifyReceiptHash);

// Payment history for a patient
router.get('/patient/:id', auth, ctrl.getPatientPaymentHistory);

// Receipt endpoints
router.get('/:appointmentId/receipt/pdf', auth, ctrl.getReceiptPdf);
router.post('/:appointmentId/receipt/email', auth, ctrl.sendReceiptEmail);

// Payment details for a specific appointment
router.get('/:appointmentId', auth, ctrl.getPaymentByAppointment);

// Admin: Get all system payments
router.get('/', auth, ctrl.getAllPayments);

module.exports = router;
