const { body, validationResult } = require('express-validator');

// ─── Reusable middleware to return 422 if any validation failed ────────────
const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    next();
};

// ─── Rules for POST /api/appointments ─────────────────────────────────────
const createAppointmentRules = [
    body('patientId').notEmpty().withMessage('patientId is required'),
    body('patientName').notEmpty().withMessage('patientName is required'),
    body('doctorId').notEmpty().withMessage('doctorId is required'),
    body('doctorName').notEmpty().withMessage('doctorName is required'),
    body('specialty').notEmpty().withMessage('specialty is required'),
    body('slotDate')
        .notEmpty().withMessage('slotDate is required')
        .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('slotDate must be YYYY-MM-DD')
        .custom((value) => {
            if (new Date(value) < new Date(new Date().setHours(0,0,0,0))) {
                throw new Error('Appointment date must be in the future');
            }
            return true;
        }),
    body('slotTime').notEmpty().withMessage('slotTime is required'),
    body('consultationFee')
        .isFloat({ min: 0 }).withMessage('consultationFee must be a non-negative number'),
    handleValidation,
];

// ─── Rules for PUT /api/appointments/:id/status ────────────────────────────
const updateStatusRules = [
    body('status')
        .isIn(['pending', 'confirmed', 'cancelled', 'completed', 'rejected'])
        .withMessage('Invalid status value'),
    handleValidation,
];

module.exports = { createAppointmentRules, updateStatusRules };
