const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const productController = require('../controllers/productController');
const { auth, requireCompleteRegistration } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, unique + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => {
    // Accept all image types; multer sometimes gets application/octet-stream from mobile
    const ok = file.mimetype.startsWith('image/') ||
      !file.mimetype || file.mimetype === 'application/octet-stream';
    if (ok) cb(null, true);
    else cb(new Error('Type de fichier non autorisé: ' + file.mimetype));
  },
});

const router = express.Router();

const multerMiddleware = (req, res, next) => {
  upload.array('images', 4)(req, res, (err) => {
    if (err) {
      console.log('[PRODUCT] Multer error:', err.message);
      return res.status(400).json({ message: err.message || 'Erreur upload' });
    }
    next();
  });
};

router.get('/', auth, productController.getAll);
router.post('/', auth, requireCompleteRegistration, multerMiddleware, productController.create);
router.put('/:id', auth, requireCompleteRegistration, productController.update);
router.delete('/mine', auth, requireCompleteRegistration, productController.deleteAllMine);
router.delete('/all', auth, requireCompleteRegistration, productController.deleteAll);
router.delete('/:id', auth, requireCompleteRegistration, productController.delete);

module.exports = router;
