const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken'); // Adjust path to your middleware if needed
const {
    registerUser,
    loginUser,
    googleLoginUser, // 👈 1. IMPORT THE NEW CONTROLLER FUNCTION
    getMe,
    logoutUser,
    updateProfile,
} = require('../controllers/authController');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/google', googleLoginUser); // 👈 2. ADD THIS EXACT LINE FOR THE GOOGLE ENDPOINT

// Protected routes
router.get('/me', verifyToken, getMe);
router.put('/profile', verifyToken, updateProfile);

module.exports = router;