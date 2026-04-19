const Appointment = require('../models/Appointment');
const axios = require('axios');
const { sendEvent } = require('../utils/kafka');

const DOCTOR_SERVICE_URL =
    process.env.DOCTOR_SERVICE_URL || 'http://localhost:3002';

// ─── Valid status transitions ───────────────────────────────────────────────
// Maps current status → allowed next statuses
const STATUS_TRANSITIONS = {
    pending: ['confirmed', 'rejected', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
    completed: [],
    rejected: [],
    cancelled: [],
};

// ── Doctor Search ────────────────────────────────────────────────────────────
exports.searchDoctors = async (req, res, next) => {
    try {
        const { specialty } = req.query;
        const url = `${DOCTOR_SERVICE_URL}/api/doctors${specialty ? `?specialty=${encodeURIComponent(specialty)}` : ''
            }`;
        const { data } = await axios.get(url);
        res.json(data);
    } catch (error) {
        res.status(502).json({ message: 'Could not reach doctor service', error: error.message });
    }
};

// ── Doctor Details ────────────────────────────────────────────────────────────
exports.getDoctorDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const url = `${DOCTOR_SERVICE_URL}/api/doctors/${id}`;
        const { data } = await axios.get(url);
        res.json(data);
    } catch (error) {
        res.status(502).json({ message: 'Could not reach doctor service', error: error.message });
    }
};

// ── Book Appointment ─────────────────────────────────────────────────────────
exports.createAppointment = async (req, res, next) => {
    try {
        const {
            patientId, patientName, patientEmail,
            doctorId, doctorName, specialty,
            slotDate, slotTime, reason, consultationFee,
        } = req.body;

        if (req.user && req.user.role !== 'admin' && req.user.id !== patientId) {
            return res.status(403).json({ message: 'Forbidden: You can only book appointments for yourself.' });
        }

        // Prevent double-booking the same slot
        const conflict = await Appointment.findOne({
            doctorId, slotDate, slotTime,
            status: { $in: ['pending', 'confirmed', 'completed'] },
        });
        if (conflict) {
            return res.status(409).json({ message: 'This slot is already booked.' });
        }

        // Verify doctor's availability
        try {
            const availUrl = `${DOCTOR_SERVICE_URL}/api/doctors/${doctorId}/availability`;
            console.log(`[Appointment Service] Internal check: ${availUrl}`);
            const { data: availability } = await axios.get(availUrl, {
                headers: { Authorization: req.headers.authorization }
            });
            
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const requestedDate = new Date(slotDate);
            const requestedDay = days[requestedDate.getUTCDay()];

            console.log(`[Appointment Service] Validation -> Date: ${slotDate}, Day: ${requestedDay}, Slot: ${slotTime}`);
            console.log(`[Appointment Service] Doctor Availability:`, JSON.stringify(availability));
            
            const isAvailable = availability.some(a => 
                a.day === requestedDay && 
                `${a.startTime} - ${a.endTime}` === slotTime
            );

            if (!isAvailable) {
                console.warn(`[Appointment Service] BLOCKED: Slot ${slotTime} on ${requestedDay} is NOT in doctor ${doctorId} availability.`);
                return res.status(400).json({ message: 'Invalid slot: Doctor is not available at this time.' });
            }
            console.log(`[Appointment Service] SUCCESS: Slot ${slotTime} on ${requestedDay} validated.`);
        } catch (error) {
            console.error('[Appointment Service] Availability Check Failed:', error.message);
            return res.status(502).json({ message: 'Could not verify doctor availability. Please try again later.' });
        }

        const appointment = new Appointment({
            patientId, patientName, patientEmail,
            doctorId, doctorName, specialty,
            slotDate, slotTime, reason, consultationFee,
        });
        await appointment.save();

        // Dispatch Kafka Event
        await sendEvent('appointment-events', {
            type: 'APPOINTMENT_CREATED',
            data: {
                appointmentId: appointment._id,
                patientId,
                patientName,
                patientEmail,
                doctorId,
                doctorName,
                specialty,
                date: slotDate,
                time: slotTime,
                fee: consultationFee
            }
        });

        res.status(201).json(appointment);
    } catch (error) {
        next(error);
    }
};

// ── Get Single Appointment ───────────────────────────────────────────────────
exports.getAppointment = async (req, res, next) => {
    try {
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
        
        // Authorization check
        if (req.user && req.user.role !== 'admin' && req.user.id !== appointment.patientId && req.user.id !== appointment.doctorId) {
            return res.status(403).json({ message: 'Forbidden: Unauthorized access to this appointment.' });
        }

        res.json(appointment);
    } catch (error) {
        next(error);
    }
};

// ── Patient's Appointments (with auto-cancel check) ───────────────────────────
exports.getPatientAppointments = async (req, res, next) => {
    try {
        if (req.user && req.user.role !== 'admin' && req.user.id !== req.params.patientId) {
            return res.status(403).json({ message: 'Forbidden: You cannot view another patient\'s appointments.' });
        }

        // Auto-cancel unpaid pending appointments older than 30 mins
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
        await Appointment.updateMany(
            {
                patientId: req.params.patientId,
                status: 'pending',
                paymentStatus: 'unpaid',
                createdAt: { $lt: thirtyMinsAgo }
            },
            {
                $set: {
                    status: 'cancelled',
                    cancelledBy: 'system',
                    cancellationReason: 'Payment timeout (30 minutes)'
                }
            }
        );

        const { status } = req.query;
        const filter = { patientId: req.params.patientId };
        if (status) filter.status = status;
        const appointments = await Appointment.find(filter).sort({ slotDate: 1, slotTime: 1 });
        res.json(appointments);
    } catch (error) {
        next(error);
    }
};

// ── Doctor's Appointments ────────────────────────────────────────────────────
exports.getDoctorAppointments = async (req, res, next) => {
    try {
        if (req.user && req.user.role !== 'admin' && req.user.id !== req.params.doctorId) {
            return res.status(403).json({ message: 'Forbidden: You cannot view another doctor\'s schedule.' });
        }

        const { status, date } = req.query;
        const filter = { doctorId: req.params.doctorId };
        if (status) filter.status = status;
        if (date) filter.slotDate = date;

        console.log(`[Appointment Service] Fetching for doctorId: ${req.params.doctorId}, filter:`, JSON.stringify(filter));
        const appointments = await Appointment.find(filter).sort({ slotDate: 1, slotTime: 1 });
        console.log(`[Appointment Service] Found ${appointments.length} appointments for doctor ${req.params.doctorId}`);
        
        res.json(appointments);
    } catch (error) {
        next(error);
    }
};

// ── Update Appointment Status ─────────────────────────────────────────────────
exports.updateStatus = async (req, res, next) => {
    try {
        const { status, cancelledBy, cancellationReason, notes } = req.body;

        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

        // Enforce RBAC
        if (['confirmed', 'rejected'].includes(status) && req.user && req.user.role !== 'admin' && req.user.role !== 'doctor') {
            return res.status(403).json({ message: 'Forbidden: Only a doctor or admin can confirm or reject.' });
        }
        if (status === 'cancelled' && req.user && req.user.role !== 'admin' && req.user.role !== 'doctor' && req.user.id !== appointment.patientId) {
            return res.status(403).json({ message: 'Forbidden: You cannot cancel this appointment.' });
        }

        // Enforce lifecycle transitions
        const allowed = STATUS_TRANSITIONS[appointment.status] || [];
        if (!allowed.includes(status)) {
            return res.status(400).json({
                message: `Cannot transition from '${appointment.status}' to '${status}'. Allowed: [${allowed.join(', ') || 'none'}]`,
            });
        }

        appointment.status = status;
        if (cancelledBy) appointment.cancelledBy = cancelledBy;
        if (cancellationReason) appointment.cancellationReason = cancellationReason;
        if (notes) appointment.notes = notes;

        await appointment.save();
        res.json(appointment);
    } catch (error) {
        next(error);
    }
};

// ── Update Payment Status (called by Payment Service) ────────────────────────
exports.updatePaymentStatus = async (req, res, next) => {
    try {
        const { paymentStatus, paymentId } = req.body;
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

        const allowed = ['unpaid', 'paid', 'refunded'];
        if (!allowed.includes(paymentStatus)) {
            return res.status(400).json({ message: `Invalid paymentStatus. Must be: ${allowed.join(', ')}` });
        }

        appointment.paymentStatus = paymentStatus;
        if (paymentId) appointment.paymentId = paymentId;

        // Auto-confirm immediately after successful payment unless appointment is already terminal.
        if (paymentStatus === 'paid' && appointment.status === 'pending') {
            appointment.status = 'confirmed';
            appointment.notes = [appointment.notes, 'Auto-confirmed after payment success'].filter(Boolean).join(' | ');
        }

        await appointment.save();
        res.json(appointment);
    } catch (error) {
        next(error);
    }
};

// ── Reschedule Appointment ────────────────────────────────────────────────────
exports.rescheduleAppointment = async (req, res, next) => {
    try {
        const { slotDate, slotTime } = req.body || {};
        if (!slotDate || !slotTime) {
            return res.status(400).json({ message: 'slotDate and slotTime are required.' });
        }

        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

        if (req.user && req.user.role !== 'admin' && req.user.id !== appointment.patientId && req.user.id !== appointment.doctorId) {
            return res.status(403).json({ message: 'Forbidden: you cannot reschedule this appointment.' });
        }

        if (!['pending', 'confirmed'].includes(appointment.status)) {
            return res.status(400).json({ message: 'Only pending or confirmed appointments can be rescheduled.' });
        }

        const conflict = await Appointment.findOne({
            _id: { $ne: appointment._id },
            doctorId: appointment.doctorId,
            slotDate,
            slotTime,
            status: { $in: ['pending', 'confirmed', 'completed'] },
        });
        if (conflict) {
            return res.status(409).json({ message: 'This slot is already booked.' });
        }

        appointment.slotDate = slotDate;
        appointment.slotTime = slotTime;
        await appointment.save();

        await sendEvent('appointment-events', {
            type: 'APPOINTMENT_RESCHEDULED',
            data: {
                appointmentId: appointment._id,
                patientEmail: appointment.patientEmail,
                doctorName: appointment.doctorName,
                date: slotDate,
                time: slotTime,
            },
        });

        res.json(appointment);
    } catch (error) {
        next(error);
    }
};

// ── Admin: All Appointments ──────────────────────────────────────────────────
exports.listAllAppointments = async (req, res, next) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required.' });
        }
        const { status } = req.query;
        const filter = status ? { status } : {};
        const appointments = await Appointment.find(filter).sort({ createdAt: -1 }).limit(500);
        res.json(appointments);
    } catch (error) {
        next(error);
    }
};

// ── Cancel Appointment ────────────────────────────────────────────────────────
exports.cancelAppointment = async (req, res, next) => {
    try {
        const { cancelledBy, cancellationReason } = req.body;
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

        if (req.user && req.user.role !== 'admin' && req.user.role !== 'doctor' && req.user.id !== appointment.patientId) {
            return res.status(403).json({ message: 'Forbidden: You cannot cancel this appointment.' });
        }

        if (!['pending', 'confirmed'].includes(appointment.status)) {
            return res.status(400).json({
                message: 'Only pending or confirmed appointments can be cancelled.',
            });
        }

        const wasPaid = appointment.paymentStatus === 'paid';

        appointment.status = 'cancelled';
        appointment.cancelledBy = cancelledBy || (req.user && req.user.role ? req.user.role : 'patient');
        if (cancellationReason) appointment.cancellationReason = cancellationReason;
        await appointment.save();

        // Dispatch Event for Refund / Notification
        await sendEvent('appointment-events', {
            type: 'APPOINTMENT_CANCELLED',
            data: {
                appointmentId: appointment._id,
                patientId: appointment.patientId,
                paymentStatus: appointment.paymentStatus,
                wasPaid,
                cancelledBy: appointment.cancelledBy,
                cancellationReason: appointment.cancellationReason
            }
        });

        res.json({ message: 'Appointment cancelled successfully', appointment });
    } catch (error) {
        next(error);
    }
};

// ── Get Booked Slots for a Doctor ─────────────────────────────────────────────
exports.getBookedSlots = async (req, res, next) => {
    try {
        const { date } = req.query;
        const filter = {
            doctorId: req.params.doctorId,
            status: { $in: ['pending', 'confirmed', 'completed'] },
        };
        if (date) filter.slotDate = date;
        const booked = await Appointment.find(filter, 'slotDate slotTime -_id');
        res.json(booked);
    } catch (error) {
        next(error);
    }
};

// ── Doctor Dashboard Stats ────────────────────────────────────────────────────
exports.getDoctorStats = async (req, res, next) => {
    try {
        if (req.user && req.user.role !== 'admin' && req.user.id !== req.params.doctorId) {
            return res.status(403).json({ message: 'Forbidden: You cannot view another doctor\'s analytics.' });
        }

        const { doctorId } = req.params;
        const [total, pending, confirmed, completed, cancelled, earningsData] = await Promise.all([
            Appointment.countDocuments({ doctorId }),
            Appointment.countDocuments({ doctorId, status: 'pending' }),
            Appointment.countDocuments({ doctorId, status: 'confirmed' }),
            Appointment.countDocuments({ doctorId, status: 'completed' }),
            Appointment.countDocuments({ doctorId, status: 'cancelled' }),
            Appointment.aggregate([
                { $match: { doctorId, status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$consultationFee' } } }
            ])
        ]);

        const totalEarnings = earningsData.length > 0 ? earningsData[0].total : 0;
        
        // Completion rate: (completed / (completed + cancelled + rejected during confirmed state))
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        res.json({ total, pending, confirmed, completed, cancelled, totalEarnings, completionRate });
    } catch (error) {
        next(error);
    }
};

// ── Admin: Get All Appointments ──────────────────────────────────────────────
exports.getAllAppointments = async (req, res, next) => {
    try {
        if (req.user && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Admin access only.' });
        }
        const appointments = await Appointment.find().sort({ createdAt: -1 });
        res.json(appointments);
    } catch (error) {
        next(error);
    }
};
