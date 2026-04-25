const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notificationController');
const { auth, requireRole } = require('../middleware/auth');

// ── Direct dispatch endpoints (legacy, used for service-to-service sends) ────
router.post('/email', async (req, res) => {
  const { to, subject, text } = req.body;
  try {
    await ctrl.sendEmail(to, subject, text);
    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/sms', async (req, res) => {
  const { to, message } = req.body;
  try {
    await ctrl.sendSMS(to, message);
    res.json({ message: 'SMS sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Authenticated user + admin endpoints ─────────────────────────────────────
router.post('/admin/trigger', auth, requireRole('admin'), ctrl.adminTriggerNotification);

router.get('/', auth, ctrl.getMyNotifications);
router.patch('/read-all', auth, ctrl.markAllAsRead);
router.get('/:id', auth, ctrl.getNotificationById);
router.patch('/:id/read', auth, ctrl.markAsRead);
router.delete('/:id', auth, ctrl.deleteNotification);

module.exports = router;
