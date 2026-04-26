const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb://localhost:27017/medsync_doctor'); // Assuming default
  const Doctor = require('./backend/services/doctor-management/src/models/Doctor');
  const docs = await Doctor.find({});
  console.log(docs.map(d => ({ name: d.name, licenseImageUrl: d.licenseImageUrl })));
  process.exit(0);
}
check();
