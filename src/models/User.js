const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nom: { type: String },
  prenom: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['client', 'fournisseur'], 
    default: null 
  },
  otpVerified: { type: Boolean, default: false },
  otpCode: { type: String },
  otpExpires: { type: Date },
  // Fournisseur-specific
  societeNom: { type: String },
  produitAVendre: { type: String },
  descriptionActivite: { type: String },
  registrationComplete: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
