const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const PendingRegistration = require('../models/PendingRegistration');
const { sendOtpEmail } = require('../services/mailer');

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const generateOtp = () => crypto.randomInt(100000, 999999).toString();

// POST /auth/register - nom, prenom, email, password (NO User saved - only pending)
exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email existe déjà' });
    }
    await PendingRegistration.deleteOne({ email });
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const pending = new PendingRegistration({
      email,
      nom: nom || '',
      prenom: prenom || '',
      password,
      otpCode: code,
      otpExpires: expiresAt,
    });
    await pending.save();

    const mailResult = await sendOtpEmail(email, code);
    if (!mailResult.ok) {
      console.warn('[DEV] Registration OTP (email failed):', email, code);
    }

    res.status(201).json({
      message: 'Code envoyé à votre email',
      email,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// POST /auth/resend-otp - email
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email requis' });
    const pending = await PendingRegistration.findOne({ email });
    if (!pending) return res.status(404).json({ message: 'Inscription introuvable ou expirée' });

    const code = generateOtp();
    pending.otpCode = code;
    pending.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await pending.save();

    await sendOtpEmail(email, code);
    res.json({ message: 'Code renvoyé' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// POST /auth/verify-otp - email, otp (creates User here, first DB save)
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email et OTP requis' });
    }
    const pending = await PendingRegistration.findOne({ email });
    if (!pending) {
      return res.status(400).json({ message: 'Inscription expirée. Veuillez vous réinscrire.' });
    }
    if (pending.otpCode !== otp) {
      return res.status(400).json({ message: 'Code OTP invalide' });
    }
    if (new Date() > pending.otpExpires) {
      await PendingRegistration.deleteOne({ email });
      return res.status(400).json({ message: 'Code OTP expiré' });
    }

    const user = new User({
      email: pending.email,
      nom: pending.nom,
      prenom: pending.prenom,
      password: pending.password,
      otpVerified: true,
    });
    await user.save();
    await PendingRegistration.deleteOne({ email });

    const token = generateToken(user._id);
    res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        registrationComplete: user.registrationComplete,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// POST /auth/login - email, password
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    if (!user.otpVerified) {
      return res.status(403).json({ message: 'Veuillez vérifier votre email avec le code OTP envoyé' });
    }
    if (!user.registrationComplete) {
      const token = generateToken(user._id);
      return res.json({
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          nom: user.nom,
          prenom: user.prenom,
          role: user.role,
          registrationComplete: false,
        },
      });
    }
    const token = generateToken(user._id);
    res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        registrationComplete: true,
        societeNom: user.societeNom,
        produitAVendre: user.produitAVendre,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// POST /auth/choose-role - role: 'client' | 'fournisseur'
exports.chooseRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['client', 'fournisseur'].includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' });
    }
    const user = req.user;
    user.role = role;
    if (role === 'client') {
      user.registrationComplete = true;
    }
    await user.save();
    const token = generateToken(user._id);
    res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        registrationComplete: user.registrationComplete,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// POST /auth/fournisseur-info - societeNom, produitAVendre, descriptionActivite
exports.updateFournisseurInfo = async (req, res) => {
  try {
    const { societeNom, produitAVendre, descriptionActivite } = req.body;
    const user = req.user;
    if (user.role !== 'fournisseur') {
      return res.status(400).json({ message: 'Non autorisé' });
    }
    user.societeNom = societeNom || user.societeNom;
    user.produitAVendre = produitAVendre || user.produitAVendre;
    user.descriptionActivite = descriptionActivite || user.descriptionActivite;
    user.registrationComplete = true;
    await user.save();
    const token = generateToken(user._id);
    res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        registrationComplete: true,
        societeNom: user.societeNom,
        produitAVendre: user.produitAVendre,
        descriptionActivite: user.descriptionActivite,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

// GET /auth/me
exports.me = async (req, res) => {
  try {
    const user = req.user;
    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        registrationComplete: user.registrationComplete,
        societeNom: user.societeNom,
        produitAVendre: user.produitAVendre,
        descriptionActivite: user.descriptionActivite,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};
