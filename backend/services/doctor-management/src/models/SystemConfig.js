const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    defaultConsultationFee: { type: Number, default: 0, min: 0 },
    updatedBy: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemConfig', systemConfigSchema);