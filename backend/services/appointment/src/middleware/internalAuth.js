// Service-to-service authentication via a shared secret header.
// Used for endpoints that should never be called directly by a browser
// (e.g. payment service updating an appointment's paymentStatus).
//
// Set INTERNAL_API_KEY in env (k8s secret in production). The expected header
// is `x-internal-api-key`. If INTERNAL_API_KEY is not configured, the middleware
// logs a warning and rejects every request to fail closed.

module.exports = (req, res, next) => {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    console.error('[appointment] INTERNAL_API_KEY is not configured — rejecting internal request');
    return res.status(503).json({ message: 'Internal auth not configured' });
  }
  const provided = req.headers['x-internal-api-key'];
  if (!provided || provided !== expected) {
    return res.status(401).json({ message: 'Invalid or missing internal API key' });
  }
  next();
};
