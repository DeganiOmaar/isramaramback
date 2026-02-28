const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productNom: { type: String, required: true },
  fournisseurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quantite: { type: Number, required: true, min: 1 },
  prixUnitaireTND: { type: Number, required: true, min: 0 },
});

const orderSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientNom: { type: String },
  clientPrenom: { type: String },
  items: [orderItemSchema],
  montantTotalTND: { type: Number, required: true, min: 0 },
  // nouvelle = en attente réponse fournisseur, pending = fournisseur a accepté, refusee = fournisseur a refusé
  status: { type: String, enum: ['nouvelle', 'pending', 'refusee'], default: 'nouvelle' },
  fournisseurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fournisseurAccepteAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
