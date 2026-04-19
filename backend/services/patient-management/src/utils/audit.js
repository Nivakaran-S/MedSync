const Patient = require('../models/Patient');

/**
 * Append a single entry to a patient's audit log without loading the doc.
 * Designed to be fire-and-forget — failures are logged, never thrown.
 */
async function recordAccess({ patientId, accessedBy, accessedByRole, action, resource, ipAddress }) {
  if (!patientId) return;
  try {
    await Patient.updateOne(
      { _id: patientId },
      {
        $push: {
          auditLog: {
            timestamp: new Date(),
            accessedBy: accessedBy || 'unknown',
            accessedByRole: accessedByRole || 'system',
            action,
            resource,
            ipAddress,
          },
        },
      }
    );
  } catch (err) {
    console.error('[audit] failed to record access:', err.message);
  }
}

/**
 * Express middleware that captures req metadata and exposes a logger on req.
 * Use req.audit({ patientId, action, resource }) inside controllers.
 */
function auditMiddleware(req, _res, next) {
  req.audit = (entry) =>
    recordAccess({
      ...entry,
      accessedBy: req.user?.id || req.user?.email,
      accessedByRole: req.user?.role || 'system',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
    });
  next();
}

module.exports = { recordAccess, auditMiddleware };
