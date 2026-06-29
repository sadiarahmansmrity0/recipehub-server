const express = require('express');
const router = express.Router();

// Simple test route
router.get('/test', (req, res) => {
    res.json({ message: 'Route is working!' });
});

// Featured recipes - simplified
router.get('/featured', async (req, res) => {
    try {
        const Recipe = require('../models/Recipe');
        const recipes = await Recipe.find({ isFeatured: true }).limit(6);
        res.json(recipes);
    } catch (error) {
        res.json([]);
    }
});

// Popular recipes - simplified
router.get('/popular', async (req, res) => {
    try {
        const Recipe = require('../models/Recipe');
        const recipes = await Recipe.find({}).sort({ likesCount: -1 }).limit(6);
        res.json(recipes);
    } catch (error) {
        res.json([]);
    }
});

module.exports = router;