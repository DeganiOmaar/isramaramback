const express = require('express');
const orderController = require('../controllers/orderController');
const { auth, requireCompleteRegistration } = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, requireCompleteRegistration, orderController.create);
router.get('/mes-commandes', auth, orderController.getMyOrders);
router.get('/commandes-recues', auth, orderController.getReceivedOrders);
router.put('/:id/accepter', auth, orderController.accept);
router.put('/:id/refuser', auth, orderController.refuse);
router.get('/notifications', auth, orderController.getNotifications);

module.exports = router;
