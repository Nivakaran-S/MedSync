const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/patientController');
const { authMiddleware } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// ─── Public ───────────────────────────────────────────────────────────────────
router.post('/register', ctrl.register);
router.post('/login', ctrl.login);

// ─── Self-service profile ────────────────────────────────────────────────────
router.get('/profile', authMiddleware, ctrl.getProfile);
router.put('/profile', authMiddleware, upload.single('photo'), ctrl.updateProfile);
router.post('/profile/change-password', authMiddleware, ctrl.changePassword);
router.delete('/profile', authMiddleware, ctrl.deactivateAccount);

// ─── Allergies ────────────────────────────────────────────────────────────────
router.get('/allergies', authMiddleware, ctrl.listAllergies);
router.post('/allergies', authMiddleware, ctrl.addAllergy);
router.delete('/allergies/:id', authMiddleware, ctrl.deleteAllergy);

// ─── Vital signs ──────────────────────────────────────────────────────────────
router.get('/vital-signs', authMiddleware, ctrl.getVitalSigns);
router.post('/vital-signs', authMiddleware, ctrl.addVitalSign);
router.delete('/vital-signs/:id', authMiddleware, ctrl.deleteVitalSign);

// ─── Vaccinations ─────────────────────────────────────────────────────────────
router.get('/vaccinations', authMiddleware, ctrl.getVaccinations);
router.post('/vaccinations', authMiddleware, ctrl.addVaccination);
router.delete('/vaccinations/:id', authMiddleware, ctrl.deleteVaccination);

// ─── Chronic conditions ───────────────────────────────────────────────────────
router.get('/chronic-conditions', authMiddleware, ctrl.getChronicConditions);
router.post('/chronic-conditions', authMiddleware, ctrl.addChronicCondition);
router.put('/chronic-conditions/:id', authMiddleware, ctrl.updateChronicCondition);
router.delete('/chronic-conditions/:id', authMiddleware, ctrl.deleteChronicCondition);

// ─── Family history ───────────────────────────────────────────────────────────
router.get('/family-history', authMiddleware, ctrl.getFamilyHistory);
router.post('/family-history', authMiddleware, ctrl.addFamilyHistory);
router.delete('/family-history/:id', authMiddleware, ctrl.deleteFamilyHistory);

// ─── Insurance ────────────────────────────────────────────────────────────────
router.get('/insurance', authMiddleware, ctrl.getInsurance);
router.put('/insurance', authMiddleware, ctrl.updateInsurance);

// ─── Medical records (own) ────────────────────────────────────────────────────
router.get('/records', authMiddleware, ctrl.getRecords);
router.post('/records/history', authMiddleware, ctrl.addMedicalRecord);
router.put('/records/history/:id', authMiddleware, ctrl.updateMedicalRecord);
router.delete('/records/history/:id', authMiddleware, ctrl.deleteMedicalRecord);
router.post('/records/prescriptions', authMiddleware, ctrl.addPrescription);
router.put('/records/prescriptions/:id', authMiddleware, ctrl.updatePrescription);
router.delete('/records/prescriptions/:id', authMiddleware, ctrl.deletePrescription);

// ─── Documents ────────────────────────────────────────────────────────────────
router.get('/documents', authMiddleware, ctrl.getDocuments);
router.post('/documents/upload', authMiddleware, upload.single('file'), ctrl.uploadDocument);
router.delete('/documents/:id', authMiddleware, ctrl.deleteDocument);

// ─── Self-service derived analytics ───────────────────────────────────────────
router.get('/health-score', authMiddleware, ctrl.getHealthScore);
router.get('/summary', authMiddleware, ctrl.getMedicalSummary);

// ─── A5/A6: Self-service privacy/portability ──────────────────────────────────
router.get('/audit-log', authMiddleware, ctrl.getMyAuditLog);
router.get('/data-export', authMiddleware, ctrl.exportMyData);

// ─── Admin: list all patients ────────────────────────────────────────────────
router.get('/', authMiddleware, ctrl.listPatients);

// ─── Doctor / admin scoped (must come AFTER literal routes above) ─────────────
router.post('/:patientId/prescriptions', authMiddleware, ctrl.doctorIssuePrescription);
router.get('/:patientId/full', authMiddleware, ctrl.getPatientForProvider);
router.get('/:patientId/health-score', authMiddleware, ctrl.getHealthScore);
router.get('/:patientId/summary', authMiddleware, ctrl.getMedicalSummary);
router.get('/:patientId/audit-log', authMiddleware, ctrl.getAuditLog);
router.get('/:patientId/records', authMiddleware, ctrl.getPatientRecords);
router.get('/:patientId/documents', authMiddleware, ctrl.getPatientDocuments);
router.get('/:patientId', authMiddleware, ctrl.getPatientProfile);

module.exports = router;
