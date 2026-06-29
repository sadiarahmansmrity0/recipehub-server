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

// ✅ PUBLIC ROUTES - No authentication required
router.get('/', getAllRecipes);
router.get('/featured', getFeaturedRecipes);  // ← THIS MUST EXIST
router.get('/popular', getPopularRecipes);    // ← THIS MUST EXIST
router.get('/:id', getRecipeById);

// ✅ PROTECTED ROUTES
router.post('/', verifyToken, createRecipe);
router.put('/:id', verifyToken, updateRecipe);
router.delete('/:id', verifyToken, deleteRecipe);
router.post('/:id/like', verifyToken, toggleLike);
router.post('/:id/favorite', verifyToken, toggleFavorite);
router.get('/user/my-recipes', verifyToken, getUserRecipes);
router.get('/user/favorites', verifyToken, getUserFavorites);
router.put('/:id/feature', verifyToken, toggleFeature);

module.exports = router;