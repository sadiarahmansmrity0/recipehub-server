const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');

// Get all recipes
router.get('/', async (req, res) => {
    try {
        const recipes = await Recipe.find();
        res.send(recipes);
    } catch (error) {
        res.status(500).send({ message: "Error fetching recipes" });
    }
});

module.exports = router;