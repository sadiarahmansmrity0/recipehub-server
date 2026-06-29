const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const connectDB = require('./config/db');

const app = express();

// ✅ FIXED CORS - NO WILDCARD OPTIONS
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Set-Cookie'],
}));

// ✅ REMOVED app.options('*', cors()) - THIS WAS CAUSING THE ERROR

// Webhook
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(cookieParser());

// Database
connectDB();

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/recipes', require('./routes/recipeRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/', (req, res) => {
    res.json({ message: 'RecipeHub API is running' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});