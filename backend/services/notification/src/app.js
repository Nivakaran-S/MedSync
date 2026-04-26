const express = require('express');
const cors = require('cors');
const app = express();
const notificationRoutes = require('./routes/notificationRoutes');

// Enable CORS — origin list comes from env, falls back to local dev origins
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));

app.use(express.json());

app.use('/api/notify', notificationRoutes);

app.get('/', (req, res) => {
  res.send('Notification Service is running');
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'notification' }));

module.exports = app;