const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const Notification = require('../models/notificationModel');

const sendEmail = (to, subject, text) => emailService.sendEmail(to, subject, text);
const sendSMS = (to, message) => smsService.sendSMS(to, message);

// Used by the Kafka consumer and the admin trigger endpoint to persist
// in-app notifications that the user can later read.
const createInAppNotification = async ({
  userId,
  title,
  message,
  category = 'other',
  metadata = {},
  subject = ''
}) => {
  if (!userId || !message) return null;
  try {
    return await Notification.create({
      userId: String(userId),
      recipient: String(userId),
      type: 'in-app',
      category,
      title: title || subject || '',
      subject,
      message,
      metadata
    });
  } catch (err) {
    console.error('[Notification] Failed to persist in-app notification:', err.message);
    return null;
  }
};

// GET /api/notify — list current user's notifications
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = Math.min(200, parseInt(req.query.limit) || 50);
    const page = Math.max(1, parseInt(req.query.page) || 1);

    const filter = { userId: String(userId), type: 'in-app' };
    if (unreadOnly) filter.isRead = false;

    const [items, total, unread] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: String(userId), type: 'in-app', isRead: false })
    ]);

    res.json({ items, page, limit, total, unread, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/notify/:id — view a single notification
const getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification not found' });

    if (req.user.role !== 'admin' && String(notification.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/notify/:id/read — mark a notification as read
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification not found' });

    if (req.user.role !== 'admin' && String(notification.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/notify/read-all — mark all of the caller's notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: String(req.user.id), type: 'in-app', isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    res.json({ updated: result.modifiedCount || 0 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/notify/:id — delete a notification (owner or admin)
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification not found' });

    if (req.user.role !== 'admin' && String(notification.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/notify/admin/trigger — admin-only manual notification dispatch
const adminTriggerNotification = async (req, res) => {
  try {
    const {
      userId,
      email,
      phone,
      title,
      subject,
      message,
      category = 'system',
      channels = ['in-app']
    } = req.body;

    if (!message) return res.status(400).json({ message: 'message is required' });
    if (!Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({ message: 'At least one channel is required' });
    }

    const results = { inApp: null, email: null, sms: null };
    const finalSubject = subject || title || 'MedSync notification';

    if (channels.includes('in-app')) {
      if (!userId) {
        return res.status(400).json({ message: 'userId is required for in-app channel' });
      }
      results.inApp = await createInAppNotification({
        userId,
        title,
        subject: finalSubject,
        message,
        category,
        metadata: { triggeredBy: req.user.id, manual: true }
      });
    }

    if (channels.includes('email')) {
      if (!email) return res.status(400).json({ message: 'email is required for email channel' });
      await emailService.sendEmail(email, finalSubject, message);
      results.email = 'sent';
    }

    if (channels.includes('sms')) {
      if (!phone) return res.status(400).json({ message: 'phone is required for sms channel' });
      await smsService.sendSMS(phone, message);
      results.sms = 'sent';
    }

    res.status(201).json({ message: 'Notification dispatched', results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  sendEmail,
  sendSMS,
  createInAppNotification,
  getMyNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  adminTriggerNotification,
};
