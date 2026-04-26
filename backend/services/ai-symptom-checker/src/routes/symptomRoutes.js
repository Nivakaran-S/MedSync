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

// #8 AI narrative summary (per-patient, 24h cached)
router.post('/narrative', ctrl.getNarrative);

// ─── Multi-turn conversation ──────────────────────────────────────────────────
router.post('/conversations', ctrl.startConversation);
router.post('/conversations/:id/messages', ctrl.continueConversation);
router.put('/conversations/:id/close', ctrl.closeConversation);
router.get('/conversations', ctrl.listConversations);
router.get('/conversations/patient/:patientId', ctrl.listConversations);

// ─── History & individual check ───────────────────────────────────────────────
router.get('/history/:patientId', ctrl.getHistory);
// #15 Bulk delete (must come before /:id to avoid path collision)
router.post('/checks/bulk-delete', ctrl.bulkDeleteChecks);
router.get('/checks/:id', ctrl.getCheck);
router.delete('/checks/:id', ctrl.deleteCheck);
router.post('/checks/:id/feedback', ctrl.submitFeedback);
// #14 PDF export
router.get('/checks/:id/export/pdf', ctrl.exportCheckPdf);

// ─── Admin analytics ──────────────────────────────────────────────────────────
router.get('/admin/analytics', ctrl.getAdminAnalytics);

// ─── #16 Prompt management (admin) ───────────────────────────────────────────
router.get('/admin/prompts', ctrl.listPrompts);
router.post('/admin/prompts', ctrl.createPrompt);
router.post('/admin/prompts/:id/activate', ctrl.activatePrompt);

module.exports = router;
