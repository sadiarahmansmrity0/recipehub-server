const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const {
    registerUser,
    loginUser,
    getMe,
    logoutUser,
    updateProfile,
    googleLogin
} = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/google', googleLogin);

router.get('/me', verifyToken, getMe);
router.put('/profile', verifyToken, updateProfile);

module.exports = router;