const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    index: true
  },
  recipient: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['email', 'sms', 'in-app'],
    required: true
  },
  category: {
    type: String,
    enum: [
      'appointment',
      'payment',
      'prescription',
      'account',
      'system',
      'other'
    ],
    default: 'other',
    index: true
  },
  title: {
    type: String,
    default: ''
  },
  subject: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
