const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  fournisseurNom: { type: String, required: true },
  fournisseurPrenom: { type: String, required: true },
  fournisseurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  images: { type: [String], default: [], validate: [imagesMax4, 'Maximum 4 images'] },
  quantite: { type: Number, required: true, min: 0 },
  prixTND: { type: Number, required: true, min: 0 },
}, { timestamps: true });

function imagesMax4(val) {
  return val.length <= 4;
}

module.exports = mongoose.model('Product', productSchema);
