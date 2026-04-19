const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));

// CRITICAL: Stripe webhook needs the raw request body for signature verification.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// All other routes use parsed JSON (exclude webhook)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/payments', paymentRoutes);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ service: 'Payment Service', status: 'running', timestamp: new Date() })
);

// ── Centralized Error Handler ─────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message);
  res.status(err.statusCode || 500).json({
    message: err.message || 'Internal server error',
  });
});

// TODO: Add your routes here
// app.use('/api/payments', paymentRoutes);

module.exports = app;
