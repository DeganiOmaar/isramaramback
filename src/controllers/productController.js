const Product = require('../models/Product');

// GET /products - list all products (client + fournisseur)
exports.getAll = async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .lean();
    // Ensure fournisseurId is string for client
    const serialized = products.map((p) => ({
      ...p,
      fournisseurId: p.fournisseurId?.toString?.() ?? p.fournisseurId,
    }));
    res.json({ products: serialized });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// POST /products - create product (fournisseur only)
exports.create = async (req, res) => {
  try {
    console.log('[PRODUCT] Create request - body:', JSON.stringify(req.body), 'files:', req.files?.length ?? 0);
    const user = req.user;
    if (user.role !== 'fournisseur') {
      console.log('[PRODUCT] Rejected: user is not fournisseur');
      return res.status(403).json({ message: 'Non autorisé' });
    }
    // Multer puts multipart fields in req.body
    const nom = req.body?.nom?.trim?.() ?? req.body?.nom ?? '';
    const quantite = req.body?.quantite;
    const prixTND = req.body?.prixTND;
    const images = req.files?.map((f) => `/uploads/${f.filename}`) ?? [];
    if (images.length > 4) {
      return res.status(400).json({ message: 'Maximum 4 images autorisées' });
    }
    if (!nom || quantite == null || quantite === '' || prixTND == null || prixTND === '') {
      console.log('[PRODUCT] Missing fields - nom:', nom, 'quantite:', quantite, 'prixTND:', prixTND);
      return res.status(400).json({ message: 'nom, quantite et prixTND requis' });
    }
    const product = new Product({
      nom,
      fournisseurNom: user.nom || '',
      fournisseurPrenom: user.prenom || '',
      fournisseurId: user._id,
      images,
      quantite: Number(quantite),
      prixTND: Number(prixTND),
    });
    await product.save();
    console.log('[PRODUCT] Created successfully:', product._id);
    res.status(201).json({
      product: {
        id: product._id.toString(),
        nom: product.nom,
        fournisseurNom: product.fournisseurNom,
        fournisseurPrenom: product.fournisseurPrenom,
        images: product.images,
        quantite: product.quantite,
        prixTND: product.prixTND,
        createdAt: product.createdAt,
      },
    });
  } catch (err) {
    console.error('[PRODUCT] Create error:', err.message, err.stack);
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// PUT /products/:id - update product (owner fournisseur only) - JSON body
exports.update = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'fournisseur') {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Produit non trouvé' });
    if (product.fournisseurId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'Non autorisé à modifier ce produit' });
    }
    const nom = req.body?.nom?.trim?.() ?? req.body?.nom ?? product.nom;
    const quantite = req.body?.quantite != null ? Number(req.body.quantite) : product.quantite;
    const prixTND = req.body?.prixTND != null ? Number(req.body.prixTND) : product.prixTND;
    product.nom = nom;
    product.quantite = quantite;
    product.prixTND = prixTND;
    await product.save();
    res.json({
      product: {
        id: product._id.toString(),
        nom: product.nom,
        fournisseurNom: product.fournisseurNom,
        fournisseurPrenom: product.fournisseurPrenom,
        fournisseurId: product.fournisseurId.toString(),
        images: product.images,
        quantite: product.quantite,
        prixTND: product.prixTND,
        createdAt: product.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// DELETE /products/mine - delete all products of current fournisseur
exports.deleteAllMine = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'fournisseur') {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    const result = await Product.deleteMany({ fournisseurId: user._id });
    res.json({ message: 'Liste vidée', deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// DELETE /products/all - delete ALL products (fournisseur only)
exports.deleteAll = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'fournisseur') {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    const result = await Product.deleteMany({});
    res.json({ message: 'Liste vidée', deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// DELETE /products/:id - delete product (owner fournisseur only)
exports.delete = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'fournisseur') {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Produit non trouvé' });
    if (product.fournisseurId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'Non autorisé à supprimer ce produit' });
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Produit supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};
