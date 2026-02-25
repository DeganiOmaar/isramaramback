require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/products', (req, res, next) => {
  if (req.method === 'POST') console.log('[SERVER] POST /api/products received');
  next();
});
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

// Error handler - return JSON instead of HTML for API errors
app.use((err, req, res, next) => {
  console.error('[Error]', err.message || err);
  res.status(err.status || 500).json({
    message: err.message || 'Erreur serveur',
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
