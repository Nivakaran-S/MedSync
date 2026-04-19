const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const patientRoutes = require('./routes/patientRoutes');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Patient routes
app.use('/api/patients', patientRoutes);

app.get('/', (req, res) => {
  res.json({ service: 'Patient Management Service', status: 'running' });
});

// TODO: Add your routes here
// app.use('/api/patients', patientRoutes);

module.exports = app;
