const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const conversationSchema = new mongoose.Schema(
  {
    patientId: { type: String, index: true },
    title: { type: String, default: 'Symptom consultation' },
    messages: { type: [messageSchema], default: [] },
    status: { type: String, enum: ['open', 'closed', 'escalated'], default: 'open', index: true },
    finalUrgency: { type: String, enum: ['low', 'medium', 'high', 'emergency'] },
    relatedCheckId: { type: mongoose.Schema.Types.ObjectId, ref: 'SymptomCheck' },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);
