const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const connectDB = require('./config/db');

const app = express();

app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

app.use(express.json());
app.use(cookieParser());

connectDB();

// ✅ DIRECT ROUTE DEFINITIONS - NO EXTERNAL FILES NEEDED
const Recipe = require('./models/Recipe');

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server is healthy' });
});

// ✅ FEATURED RECIPES - DIRECT IMPLEMENTATION
app.get('/api/recipes/featured', async (req, res) => {
    try {
        console.log('📡 Fetching featured recipes...');
        const recipes = await Recipe.find({ 
            isFeatured: true, 
            status: 'published' 
        }).limit(6);
        console.log(`✅ Found ${recipes.length} featured recipes`);
        res.json(recipes);
    } catch (error) {
        console.error('❌ Featured error:', error);
        res.status(500).json({ message: error.message });
    }
});

// ✅ POPULAR RECIPES - DIRECT IMPLEMENTATION
app.get('/api/recipes/popular', async (req, res) => {
    try {
        console.log('📡 Fetching popular recipes...');
        const recipes = await Recipe.find({ status: 'published' })
            .sort({ likesCount: -1 })
            .limit(6);
        console.log(`✅ Found ${recipes.length} popular recipes`);
        res.json(recipes);
    } catch (error) {
        console.error('❌ Popular error:', error);
        res.status(500).json({ message: error.message });
    }
});

// ✅ ALL RECIPES
app.get('/api/recipes', async (req, res) => {
    try {
        const recipes = await Recipe.find({ status: 'published' });
        res.json(recipes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ✅ AUTH ROUTES
app.use('/api/auth', require('./routes/authRoutes'));

// Root route
app.get('/', (req, res) => {
    res.json({ success: true, message: 'RecipeHub API running' });
});

// 404 handler - MUST BE LAST
app.use((req, res) => {
    console.log(`⚠️ 404: ${req.method} ${req.path}`);
    res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});