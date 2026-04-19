const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri, { dbName: 'medsync' });
  console.log('[appointment] MongoDB connected');
};

module.exports = connectDB;
