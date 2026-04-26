const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/symptomController');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/imageUpload');

// All endpoints require authentication
router.use(auth);

// ─── Triage ──────────────────────────────────────────────────────────────────
router.post('/analyze', ctrl.analyzeSymptoms);
router.post('/analyze-image', upload.single('image'), ctrl.analyzeImage);

// ─── Multi-turn conversation ──────────────────────────────────────────────────
router.post('/conversations', ctrl.startConversation);
router.post('/conversations/:id/messages', ctrl.continueConversation);
router.put('/conversations/:id/close', ctrl.closeConversation);
router.get('/conversations', ctrl.listConversations);
router.get('/conversations/patient/:patientId', ctrl.listConversations);

// ─── History & individual check ───────────────────────────────────────────────
router.get('/history/:patientId', ctrl.getHistory);
router.get('/checks/:id', ctrl.getCheck);
router.delete('/checks/:id', ctrl.deleteCheck);
router.post('/checks/:id/feedback', ctrl.submitFeedback);

// ─── Admin analytics ──────────────────────────────────────────────────────────
router.get('/admin/analytics', ctrl.getAdminAnalytics);

module.exports = router;
