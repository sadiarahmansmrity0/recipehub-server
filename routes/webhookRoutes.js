const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/webhookController');

// Webhook endpoint - MUST be raw body
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;