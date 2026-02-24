const mongoose = require('mongoose');

const pendingSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  nom: { type: String },
  prenom: { type: String },
  password: { type: String, required: true },
  otpCode: { type: String, required: true },
  otpExpires: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model('PendingRegistration', pendingSchema);
