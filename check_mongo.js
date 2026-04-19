const mongoose = require('mongoose');
const env = require('dotenv').config({ path: '.env' });

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/medsync');
  const Doctor = require('./backend/services/doctor-management/src/models/Doctor');
  const docs = await Doctor.find({});
  console.log(JSON.stringify(docs, null, 2));
  process.exit(0);
}
run();
