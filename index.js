const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// CORS
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// MongoDB Connection
mongoose.connect(process.env.DB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB error:', err));

// Recipe Schema (directly here to avoid import issues)
const recipeSchema = new mongoose.Schema({
    recipeName: String,
    recipeImage: String,
    category: String,
    cuisineType: String,
    difficultyLevel: String,
    preparationTime: Number,
    ingredients: [String],
    instructions: [String],
    authorId: mongoose.Schema.Types.ObjectId,
    authorName: String,
    authorEmail: String,
    likesCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    price: { type: Number, default: 0 },
    status: { type: String, default: 'published' },
}, { timestamps: true });

const Recipe = mongoose.model('Recipe', recipeSchema);

// ============================================
// ✅ ALL ROUTES DEFINED HERE
// ============================================

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Featured Recipes
app.get('/api/recipes/featured', async (req, res) => {
    try {
        console.log('📡 Getting featured recipes...');
        const recipes = await Recipe.find({ isFeatured: true }).limit(10);
        console.log(`✅ Found ${recipes.length} featured recipes`);
        res.json(recipes);
    } catch (error) {
        console.error('❌ Error:', error);
        res.json([]);
    }
});

// Popular Recipes
app.get('/api/recipes/popular', async (req, res) => {
    try {
        console.log('📡 Getting popular recipes...');
        const recipes = await Recipe.find({}).sort({ likesCount: -1 }).limit(10);
        console.log(`✅ Found ${recipes.length} popular recipes`);
        res.json(recipes);
    } catch (error) {
        console.error('❌ Error:', error);
        res.json([]);
    }
});

// All Recipes
app.get('/api/recipes', async (req, res) => {
    try {
        const recipes = await Recipe.find({});
        res.json(recipes);
    } catch (error) {
        res.json([]);
    }
});

// Auth routes (if needed)
app.post('/api/auth/login', async (req, res) => {
    res.json({ message: 'Login endpoint - implement your auth logic' });
});

app.post('/api/auth/register', async (req, res) => {
    res.json({ message: 'Register endpoint - implement your auth logic' });
});

// Root
app.get('/', (req, res) => {
    res.json({ message: 'RecipeHub API is running!' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});