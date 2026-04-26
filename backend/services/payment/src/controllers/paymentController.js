const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const Payment = require('../models/Payment');
const { sendEvent } = require('../utils/kafka');
const {
    generateReceiptNumber,
    signReceiptHash,
    buildReceiptData,
    generateReceiptPdfBuffer,
} = require('../utils/receipt');
const { sendReceiptEmail } = require('../utils/notificationClient');

const APPOINTMENT_SERVICE_URL = process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:3003';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const PAYMENT_PORT = process.env.PAYMENT_PORT || '3005';
const PAYMENT_PUBLIC_BASE_URL =
    process.env.PAYMENT_PUBLIC_BASE_URL ||
    `http://localhost:${PAYMENT_PORT}/api/payments`;

const canAccessPayment = (user, payment) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.id === payment.patientId || user.id === payment.doctorId;
};

const buildReceiptUrl = (appointmentId) => `${PAYMENT_PUBLIC_BASE_URL}/${appointmentId}/receipt/pdf`;

const calculateAuditInsights = ({ amount, currency, session }) => {
    const flags = [];
    let riskScore = 0;

    const normalizedAmount = Number(amount || 0);
    const normalizedCurrency = String(currency || 'lkr').toLowerCase();

    if (!session?.customer_details?.email) {
        flags.push('missing_customer_email');
        riskScore += 18;
    }
    if (normalizedAmount > 20000) {
        flags.push('high_value_consultation');
        riskScore += 22;
    }
    if (normalizedCurrency !== 'lkr') {
        flags.push('non_default_currency');
        riskScore += 12;
    }
    if (!session?.payment_status || session.payment_status !== 'paid') {
        flags.push('webhook_without_paid_status');
        riskScore += 35;
    }

    if (riskScore > 100) riskScore = 100;
    const riskLevel = riskScore >= 65 ? 'high' : riskScore >= 30 ? 'medium' : 'low';

    return {
        riskScore,
        riskLevel,
        flags,
        lastEvaluatedAt: new Date(),
    };
};

const sendReceiptEmailForPayment = async ({ payment, to }) => {
    if (!to || payment.status !== 'paid') return false;

    const receiptUrl = buildReceiptUrl(payment.appointmentId);
    const subject = `MedSync Receipt ${payment.receiptNumber}`;
    const text = [
        `Hello,`,
        ``,
        `Your consultation payment was successful.`,
        `Receipt Number: ${payment.receiptNumber}`,
        `Appointment ID: ${payment.appointmentId}`,
        `Amount: ${String(payment.currency || 'lkr').toUpperCase()} ${Number(payment.amount || 0).toFixed(2)}`,
        ``,
        `Download PDF Payslip: ${receiptUrl}`,
        `Receipt Hash: ${payment.receiptHash}`,
        ``,
        `Thank you,`,
        `MedSync Payments`,
    ].join('\n');

    return sendReceiptEmail({ to, subject, text });
};

// ── POST /api/payments/checkout ───────────────────────────────────────────
exports.createCheckoutSession = async (req, res, next) => {
    try {
        const { appointmentId, patientId, doctorId, doctorName, patientPhone, amount, currency = 'lkr' } = req.body;

        if (!appointmentId || !patientId || !amount) {
            return res.status(400).json({ message: 'appointmentId, patientId, and amount are required' });
        }

        if (req.user && req.user.role !== 'admin' && req.user.id !== patientId) {
            return res.status(403).json({ message: 'Forbidden: You can only process payments for your own appointments.' });
        }

        const existing = await Payment.findOne({ appointmentId, status: { $in: ['pending', 'paid'] } });
        if (existing && existing.status === 'paid') {
            return res.status(409).json({ message: 'This appointment is already paid.' });
        }

        const amountInSmallestUnit = Math.round(Number(amount) * 100);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency,
                        product_data: {
                            name: `Consultation – Dr. ${doctorName || 'Doctor'}`,
                            description: `Appointment ID: ${appointmentId}`,
                        },
                        unit_amount: amountInSmallestUnit,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                appointmentId,
                patientId,
                doctorId: doctorId || '',
                patientEmail: req.user?.email || '',
                patientPhone: patientPhone || '',
            },
            success_url: `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}/payment/cancel?appointmentId=${appointmentId}`,
        });

        await Payment.findOneAndUpdate(
            { appointmentId },
            {
                appointmentId,
                patientId,
                doctorId: doctorId || '',
                doctorName,
                amount,
                currency,
                patientPhone: patientPhone || '',
                stripeSessionId: session.id,
                status: 'pending',
            },
            { upsert: true, new: true }
        );

        res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
        next(error);
    }
};

// ── POST /api/payments/webhook ────────────────────────────────────────────
exports.handleWebhook = async (req, res, _next) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`[Webhook] Signature verification failed: ${err.message}`);
        return res.status(400).json({ message: `Webhook error: ${err.message}` });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { appointmentId, patientId } = session.metadata || {};

        try {
            const existing = await Payment.findOne({ stripeSessionId: session.id });
            if (!existing) {
                console.warn('[Webhook] payment not found for session:', session.id);
                return res.status(200).json({ received: true, warning: 'payment record not found' });
            }

            const receiptNumber = existing.receiptNumber || generateReceiptNumber();
            const receiptHash = existing.receiptHash || signReceiptHash({
                appointmentId: existing.appointmentId,
                paymentId: String(existing._id),
                amount: existing.amount,
                currency: existing.currency,
                paidAt: new Date().toISOString(),
                receiptNumber,
            });
            const auditInsights = calculateAuditInsights({ amount: existing.amount, currency: existing.currency, session });

            const payment = await Payment.findOneAndUpdate(
                { stripeSessionId: session.id },
                {
                    status: 'paid',
                    stripePaymentIntentId: session.payment_intent,
                    receiptNumber,
                    receiptHash,
                    auditInsights,
                    metadata: session,
                },
                { new: true }
            );

            const internalKey = process.env.INTERNAL_API_KEY;
            if (!internalKey) {
                throw new Error('INTERNAL_API_KEY is not configured — refusing to update appointment without auth');
            }
            await axios.put(
                `${APPOINTMENT_SERVICE_URL}/api/appointments/${appointmentId}/payment`,
                {
                    paymentStatus: 'paid',
                    paymentId: payment?._id?.toString() || session.payment_intent,
                },
                {
                    headers: { 'x-internal-api-key': internalKey },
                    timeout: 5000,
                }
            );

            const recipientEmail =
                session?.customer_details?.email ||
                session?.metadata?.patientEmail ||
                payment?.lastReceiptEmail ||
                null;

            if (recipientEmail) {
                const sent = await sendReceiptEmailForPayment({ payment, to: recipientEmail });
                if (sent) {
                    payment.receiptSentAt = new Date();
                    payment.lastReceiptEmail = recipientEmail;
                    await payment.save();
                }
            }

            await sendEvent('payment-events', {
                type: 'PAYMENT_SUCCESSFUL',
                data: {
                    appointmentId,
                    patientId,
                    amount: payment.amount,
                    currency: payment.currency,
                    patientPhone: session?.metadata?.patientPhone || payment?.metadata?.customer_details?.phone || null,
                    patientEmail: recipientEmail,
                    receiptNumber: payment.receiptNumber,
                    receiptHash: payment.receiptHash,
                    riskScore: payment.auditInsights?.riskScore || 0,
                    riskLevel: payment.auditInsights?.riskLevel || 'low',
                },
            });

            console.log(`[Webhook] Payment confirmed for appointment ${appointmentId}`);
        } catch (err) {
            // Surface failures to Stripe so it retries the webhook. Stripe retries
            // automatically on 5xx responses; logging alone would silently lose state.
            console.error(`[Webhook] Post-payment update failed: ${err.message}`);
            return res.status(500).json({
                received: true,
                error: 'post_payment_update_failed',
                message: err.message,
            });
        }
    }

    return res.status(200).json({ received: true });
};

// ── GET /api/payments/:appointmentId ──────────────────────────────────────
exports.getPaymentByAppointment = async (req, res, next) => {
    try {
        const payment = await Payment.findOne({ appointmentId: req.params.appointmentId });
        if (!payment) return res.status(404).json({ message: 'No payment found for this appointment' });

        if (!canAccessPayment(req.user, payment)) {
            return res.status(403).json({ message: 'Forbidden: You cannot view this payment record.' });
        }

        res.json({
            ...payment.toObject(),
            receiptAvailable: payment.status === 'paid' && Boolean(payment.receiptHash),
            receiptDownloadUrl: payment.status === 'paid' ? buildReceiptUrl(payment.appointmentId) : null,
        });
    } catch (error) {
        next(error);
    }
};

// ── GET /api/payments/:appointmentId/receipt/pdf ─────────────────────────
exports.getReceiptPdf = async (req, res, next) => {
    try {
        const payment = await Payment.findOne({ appointmentId: req.params.appointmentId });
        if (!payment) return res.status(404).json({ message: 'No payment found for this appointment' });
        if (!canAccessPayment(req.user, payment)) {
            return res.status(403).json({ message: 'Forbidden: You cannot download this receipt.' });
        }
        if (payment.status !== 'paid' || !payment.receiptHash) {
            return res.status(400).json({ message: 'Receipt is not available until payment is completed.' });
        }

        const receipt = buildReceiptData(payment, buildReceiptUrl(payment.appointmentId));
        const pdf = await generateReceiptPdfBuffer(receipt);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${receipt.receiptNumber}.pdf"`);
        return res.send(pdf);
    } catch (error) {
        next(error);
    }
};

// ── POST /api/payments/:appointmentId/receipt/email ──────────────────────
exports.sendReceiptEmail = async (req, res, next) => {
    try {
        const payment = await Payment.findOne({ appointmentId: req.params.appointmentId });
        if (!payment) return res.status(404).json({ message: 'No payment found for this appointment' });
        if (!canAccessPayment(req.user, payment)) {
            return res.status(403).json({ message: 'Forbidden: You cannot request this receipt email.' });
        }
        if (payment.status !== 'paid') {
            return res.status(400).json({ message: 'Receipt email is available only for paid payments.' });
        }

        const email =
            req.body?.email ||
            req.user?.email ||
            payment.lastReceiptEmail ||
            payment.metadata?.customer_details?.email ||
            null;

        if (!email) {
            return res.status(400).json({ message: 'No email found. Provide one in request body.' });
        }

        const sent = await sendReceiptEmailForPayment({ payment, to: email });
        if (!sent) {
            return res.status(502).json({ message: 'Failed to send receipt email via notification service.' });
        }

        payment.receiptSentAt = new Date();
        payment.lastReceiptEmail = email;
        await payment.save();

        return res.json({ message: 'Receipt email sent successfully.', to: email });
    } catch (error) {
        next(error);
    }
};

// ── GET /api/payments/verify/:receiptHash ────────────────────────────────
exports.verifyReceiptHash = async (req, res, next) => {
    try {
        const payment = await Payment.findOne({ receiptHash: req.params.receiptHash, status: 'paid' });
        if (!payment) {
            return res.status(404).json({ valid: false, message: 'Receipt hash not found.' });
        }

        return res.json({
            valid: true,
            receiptNumber: payment.receiptNumber,
            appointmentId: payment.appointmentId,
            amount: payment.amount,
            currency: String(payment.currency || 'lkr').toUpperCase(),
            paidAt: payment.updatedAt,
            riskLevel: payment.auditInsights?.riskLevel || 'low',
        });
    } catch (error) {
        next(error);
    }
};

// ── GET /api/payments/admin/all ───────────────────────────────────────────
exports.listAllPayments = async (req, res, next) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required.' });
        }
        const payments = await Payment.find({}).sort({ createdAt: -1 }).limit(500);
        const totals = await Payment.aggregate([
            { $match: { status: 'paid' } },
            { $group: { _id: '$currency', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]);
        res.json({ payments, totals });
    } catch (error) {
        next(error);
    }
};

// ── GET /api/payments/patient/:id ─────────────────────────────────────────
exports.getPatientPaymentHistory = async (req, res, next) => {
    try {
        if (req.user && req.user.role !== 'admin' && req.user.id !== req.params.id) {
            return res.status(403).json({ message: 'Forbidden: You cannot view another patient\'s payment history.' });
        }

        const payments = await Payment.find({ patientId: req.params.id }).sort({ createdAt: -1 });
        res.json(payments);
    } catch (error) {
        next(error);
    }
};

// ── GET /api/payments (admin) ─────────────────────────────────────────────
exports.getAllPayments = async (req, res, next) => {
    try {
        if (req.user && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Admin access only.' });
        }
        const payments = await Payment.find().sort({ createdAt: -1 });
        res.json(payments);
    } catch (error) {
        next(error);
    }
};

// ── Shared refund helper (used by admin endpoint AND kafka handler) ───────
const issueRefund = async ({ appointmentId, reason, actor }) => {
    const payment = await Payment.findOne({ appointmentId });
    if (!payment) {
        const err = new Error(`No payment found for appointment ${appointmentId}`);
        err.statusCode = 404;
        throw err;
    }
    if (payment.status === 'refunded') {
        return { payment, alreadyRefunded: true };
    }
    if (payment.status !== 'paid') {
        const err = new Error(`Cannot refund a payment in status "${payment.status}"`);
        err.statusCode = 400;
        throw err;
    }

    let stripeRefundId = null;
    if (payment.stripePaymentIntentId) {
        try {
            const refund = await stripe.refunds.create({
                payment_intent: payment.stripePaymentIntentId,
                reason: reason && ['duplicate', 'fraudulent', 'requested_by_customer'].includes(reason)
                    ? reason
                    : 'requested_by_customer',
                metadata: {
                    appointmentId: String(appointmentId),
                    actor: actor || 'system',
                },
            });
            stripeRefundId = refund.id;
        } catch (err) {
            console.error('[Payment] Stripe refund failed:', err.message);
            const wrapped = new Error(`Stripe refund failed: ${err.message}`);
            wrapped.statusCode = 502;
            throw wrapped;
        }
    } else {
        console.warn(`[Payment] Refunding payment ${payment._id} without a Stripe PaymentIntent — DB-only update`);
    }

    payment.status = 'refunded';
    payment.refundedAt = new Date();
    payment.refundedBy = actor || 'system';
    if (reason) payment.refundReason = reason;
    if (stripeRefundId) payment.stripeRefundId = stripeRefundId;
    await payment.save();

    await sendEvent('payment-events', {
        type: 'PAYMENT_REFUNDED',
        data: {
            appointmentId,
            paymentId: payment._id,
            patientId: payment.patientId,
            patientEmail: payment.patientEmail,
            patientPhone: payment.patientPhone,
            amount: payment.amount,
            currency: payment.currency,
            stripeRefundId,
            actor: actor || 'system',
            reason: reason || null,
        },
    }).catch(err => console.error('[Payment] Failed to publish PAYMENT_REFUNDED event:', err.message));

    return { payment, alreadyRefunded: false };
};

// ── POST /api/payments/:appointmentId/refund (admin) ─────────────────────
exports.refundPayment = async (req, res, next) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Admin access only.' });
        }
        const { reason } = req.body || {};
        const { payment, alreadyRefunded } = await issueRefund({
            appointmentId: req.params.appointmentId,
            reason,
            actor: req.user.email || req.user.id || 'admin',
        });
        if (alreadyRefunded) {
            return res.json({ message: 'Payment was already refunded.', payment });
        }
        res.json({ message: 'Refund issued.', payment });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        next(error);
    }
};

// ── Kafka Event Handlers ──────────────────────────────────────────────────
exports.handleAppointmentCancelledEvent = async (data) => {
    const { appointmentId, wasPaid } = data;
    if (!wasPaid) return;
    try {
        await issueRefund({
            appointmentId,
            reason: 'requested_by_customer',
            actor: 'system:appointment-cancelled',
        });
        console.log(`[Payment] Refund processed for cancelled appointment ${appointmentId}`);
    } catch (err) {
        console.error(`[Payment] Auto-refund failed for ${appointmentId}:`, err.message);
    }
};
