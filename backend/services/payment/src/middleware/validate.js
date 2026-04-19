const { body, validationResult } = require('express-validator');

// ─── Reusable middleware to return 422 if any validation failed ────────────
const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    next();
};

// ─── Rules for POST /api/payments/checkout ──────────────────────────────────
const createCheckoutRules = [
    body('appointmentId').notEmpty().withMessage('appointmentId is required'),
    body('patientId').notEmpty().withMessage('patientId is required'),
    body('amount')
        .isNumeric()
        .withMessage('amount must be a numeric value')
        .custom((value) => {
            if (value <= 0) throw new Error('amount must be greater than 0');
            return true;
        }),
    handleValidation,
];

module.exports = { createCheckoutRules };
