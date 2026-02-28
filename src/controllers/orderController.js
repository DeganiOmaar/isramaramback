const Order = require('../models/Order');
const Product = require('../models/Product');
const Notification = require('../models/Notification');

// requireClient - only clients can place orders
const requireClient = (req, res, next) => {
  if (req.user.role !== 'client') {
    return res.status(403).json({ message: 'Réservé aux clients' });
  }
  next();
};

// requireFournisseur - only suppliers
const requireFournisseur = (req, res, next) => {
  if (req.user.role !== 'fournisseur') {
    return res.status(403).json({ message: 'Réservé aux fournisseurs' });
  }
  next();
};

// POST /orders - create order (client)
exports.create = async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ message: 'Réservé aux clients' });
    }
    const { items } = req.body; // [{ productId, quantite }]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'La commande doit contenir au moins un produit' });
    }

    const ordersCreated = [];
    const itemsBySupplier = {};

    for (const it of items) {
      const product = await Product.findById(it.productId);
      if (!product) {
        return res.status(400).json({ message: `Produit ${it.productId} non trouvé` });
      }
      const qty = Math.max(1, Number(it.quantite) || 1);
      if (qty > product.quantite) {
        return res.status(400).json({ message: `Quantité insuffisante pour "${product.nom}" (disponible: ${product.quantite})` });
      }
      const fid = product.fournisseurId.toString();
      if (!itemsBySupplier[fid]) {
        itemsBySupplier[fid] = { fournisseurId: product.fournisseurId, items: [] };
      }
      itemsBySupplier[fid].items.push({ product, quantite: qty });
    }

    for (const fid of Object.keys(itemsBySupplier)) {
      const group = itemsBySupplier[fid];
      const orderItems = group.items.map(({ product, quantite }) => ({
        productId: product._id,
        productNom: product.nom,
        fournisseurId: product.fournisseurId,
        quantite,
        prixUnitaireTND: product.prixTND,
      }));
      const montantTotalTND = orderItems.reduce((s, i) => s + i.quantite * i.prixUnitaireTND, 0);

      const order = new Order({
        clientId: req.user._id,
        clientNom: req.user.nom || '',
        clientPrenom: req.user.prenom || '',
        items: orderItems,
        montantTotalTND,
        fournisseurId: group.fournisseurId,
        status: 'nouvelle',
      });
      await order.save();
      ordersCreated.push(order);

      await Notification.create({
        userId: group.fournisseurId,
        orderId: order._id,
        type: 'nouvelle_commande',
        message: `Nouvelle commande de ${req.user.prenom || ''} ${req.user.nom || ''} - ${montantTotalTND.toFixed(2)} TND`,
      });
    }

    const serialized = ordersCreated.map((o) => ({
      id: o._id.toString(),
      items: o.items,
      montantTotalTND: o.montantTotalTND,
      status: o.status,
      fournisseurId: o.fournisseurId?.toString(),
      createdAt: o.createdAt,
    }));

    res.status(201).json({ orders: serialized });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// GET /orders/mes-commandes - client's orders
exports.getMyOrders = async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ message: 'Réservé aux clients' });
    }
    const orders = await Order.find({ clientId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('items.productId', 'nom images')
      .lean();
    const serialized = orders.map((o) => ({
      ...o,
      id: o._id.toString(),
      fournisseurId: o.fournisseurId?.toString(),
      items: o.items.map((i) => ({
        ...i,
        productId: i.productId?.toString?.(),
      })),
    }));
    res.json({ orders: serialized });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// GET /orders/commandes-recues - fournisseur's orders (notifications)
exports.getReceivedOrders = async (req, res) => {
  try {
    if (req.user.role !== 'fournisseur') {
      return res.status(403).json({ message: 'Réservé aux fournisseurs' });
    }
    const orders = await Order.find({ fournisseurId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('items.productId', 'nom images')
      .lean();
    const serialized = orders.map((o) => ({
      ...o,
      id: o._id.toString(),
      fournisseurId: o.fournisseurId?.toString(),
      items: o.items.map((i) => ({
        ...i,
        productId: i.productId?.toString?.(),
      })),
    }));
    res.json({ orders: serialized });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// PUT /orders/:id/accepter - fournisseur accepts order → status = pending
exports.accept = async (req, res) => {
  try {
    if (req.user.role !== 'fournisseur') {
      return res.status(403).json({ message: 'Réservé aux fournisseurs' });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Commande non trouvée' });
    if (order.fournisseurId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    if (order.status !== 'nouvelle') {
      return res.status(400).json({ message: 'Cette commande a déjà été traitée' });
    }

    order.status = 'pending';
    order.fournisseurAccepteAt = new Date();
    await order.save();

    await Notification.create({
      userId: order.clientId,
      orderId: order._id,
      type: 'commande_acceptee',
      message: `Votre commande a été acceptée par le fournisseur`,
    });

    res.json({
      order: {
        id: order._id.toString(),
        status: order.status,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// PUT /orders/:id/refuser - fournisseur refuses
exports.refuse = async (req, res) => {
  try {
    if (req.user.role !== 'fournisseur') {
      return res.status(403).json({ message: 'Réservé aux fournisseurs' });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Commande non trouvée' });
    if (order.fournisseurId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    if (order.status !== 'nouvelle') {
      return res.status(400).json({ message: 'Cette commande a déjà été traitée' });
    }

    order.status = 'refusee';
    await order.save();

    await Notification.create({
      userId: order.clientId,
      orderId: order._id,
      type: 'commande_refusee',
      message: `Votre commande a été refusée par le fournisseur`,
    });

    res.json({
      order: {
        id: order._id.toString(),
        status: order.status,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// GET /notifications - user notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('orderId')
      .lean();
    const serialized = notifs.map((n) => ({
      ...n,
      id: n._id.toString(),
      orderId: n.orderId?._id?.toString?.(),
    }));
    res.json({ notifications: serialized });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};
