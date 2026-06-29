const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const {
    createRecipe,
    getAllRecipes,
    getFeaturedRecipes,
    getPopularRecipes,
    getRecipeById,
    updateRecipe,
    deleteRecipe,
    toggleLike,
    toggleFavorite,
    getUserRecipes,
    getUserFavorites,
    toggleFeature
} = require('../controllers/recipeController');

// Public routes
router.get('/', getAllRecipes);
router.get("/featured", (req, res, next) => {
    console.log("FEATURED ROUTE HIT");
    next();
}, getFeaturedRecipes);
router.get("/popular", (req, res, next) => {
    console.log("POPULAR ROUTE HIT");
    next();
}, getPopularRecipes);
router.get('/:id', getRecipeById);

// Protected routes
router.post('/', verifyToken, createRecipe);
router.put('/:id', verifyToken, updateRecipe);
router.delete('/:id', verifyToken, deleteRecipe);
router.post('/:id/like', verifyToken, toggleLike);
router.post('/:id/favorite', verifyToken, toggleFavorite);
router.get('/user/my-recipes', verifyToken, getUserRecipes);
router.get('/user/favorites', verifyToken, getUserFavorites);

// Admin only routes
router.put('/:id/feature', verifyToken, toggleFeature);

module.exports = router;