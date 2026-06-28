const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const {
    createPremiumCheckout,
    createRecipePurchase,
    getPurchasedRecipes,
    handleWebhook
} = require('../controllers/paymentController');

// Public webhook endpoint (must be raw body)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Protected routes
router.post('/premium', verifyToken, createPremiumCheckout);
router.post('/recipe', verifyToken, createRecipePurchase);
router.get('/purchased', verifyToken, getPurchasedRecipes);

module.exports = router;