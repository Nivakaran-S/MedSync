const express = require('express');
const cors = require('cors');
const app = express();
const notificationRoutes = require('./routes/notificationRoutes');

// Enable CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

app.use(express.json());

app.use('/api/notify', notificationRoutes);

app.get('/', (req, res) => {
  res.send('Notification Service is running');
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'notification' }));

module.exports = app;