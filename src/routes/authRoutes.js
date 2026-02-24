const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/resend-otp', authController.resendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/login', authController.login);
router.post('/choose-role', auth, authController.chooseRole);
router.post('/fournisseur-info', auth, authController.updateFournisseurInfo);
router.get('/me', auth, authController.me);

module.exports = router;
