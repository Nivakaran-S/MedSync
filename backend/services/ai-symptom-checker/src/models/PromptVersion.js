const mongoose = require('mongoose');

// #16 Prompt version management — stores triage / image / narrative prompts
// in DB with a version field. Admins can list, create, and switch the active
// one without redeploying. The controller resolves the active prompt at
// request time and falls back to the in-code default if nothing is stored.

const promptVersionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, enum: ['triage', 'image', 'narrative', 'conversation'], index: true },
    version: { type: Number, required: true, default: 1 },
    template: { type: String, required: true },
    description: { type: String },
    active: { type: Boolean, default: false, index: true },
    createdBy: { type: String },
  },
  { timestamps: true }
);

promptVersionSchema.index({ name: 1, version: -1 });
// Only one active per name. Enforced via partial filter.
promptVersionSchema.index(
  { name: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

module.exports = mongoose.model('PromptVersion', promptVersionSchema);
