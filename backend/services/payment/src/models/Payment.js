const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
    {
        appointmentId: { type: String, required: true, index: true },
        patientId: { type: String, required: true, index: true },
        doctorId: { type: String, required: true },
        doctorName: { type: String },
        amount: { type: Number, required: true }, // in smallest currency unit (e.g. paise/cents)
        currency: { type: String, default: 'lkr' },

        // Stripe identifiers
        stripeSessionId: { type: String, unique: true, sparse: true },
        stripePaymentIntentId: { type: String },

        status: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending',
        },

        receiptNumber: { type: String, unique: true, sparse: true },
        receiptHash: { type: String, unique: true, sparse: true },
        receiptSentAt: { type: Date },
        lastReceiptEmail: { type: String },

        auditInsights: {
            riskScore: { type: Number, default: 0 },
            riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
            flags: { type: [String], default: [] },
            lastEvaluatedAt: { type: Date },
        },

        // Store Stripe metadata for audit
        metadata: { type: mongoose.Schema.Types.Mixed },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
