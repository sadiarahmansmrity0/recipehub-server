const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User'); // Adjust this path if your model is in a different directory

// ============================================
// 1. REGISTER USER
// ============================================
const registerUser = async (req, res) => {
    try {
        const { name, email, password, image } = req.body;
        
        // Normalize email to prevent duplicate lowercase/uppercase registration holes
        const normalizedEmail = email.toLowerCase();
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            image: image || ''
        });
        await user.save();

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const userData = user.toObject();
        delete userData.password;
        res.json({ success: true, user: userData });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Registration failed' });
    }
};

// ============================================
// 2. EMAIL/PASSWORD LOGIN
// ============================================
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const userData = user.toObject();
        delete userData.password;
        res.json({ success: true, user: userData });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Login failed' });
    }
};

// ============================================
// 3. GOOGLE OAUTH LOGIN (The Fix)
// ============================================
const googleLoginUser = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: 'Google token is required' });
        }

        // Fetch user profile from Google using the implicit client access token
        const googleResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });

        const { name, email, picture } = googleResponse.data;
        const normalizedEmail = email.toLowerCase();

        // Check if user already exists
        let user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            // Register them instantly if it's their first time
            user = new User({
                name,
                email: normalizedEmail,
                image: picture || '',
                role: 'user',
                isPremium: false,
                recipeCount: 0
            });
            await user.save();
        }

        // Issue token session
        const jwtToken = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        res.cookie('token', jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const userData = user.toObject();
        delete userData.password;

        return res.json({ success: true, user: userData });
    } catch (error) {
        console.error('❌ Google Auth Controller Error:', error.message);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to authenticate registration session via Google.' 
        });
    }
};

// ============================================
// 4. GET CURRENT SESSION USER (ME)
// ============================================
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// ============================================
// 5. UPDATE PROFILE
// ============================================
const updateProfile = async (req, res) => {
    try {
        const { name, image } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { name, image } },
            { new: true }
        ).select('-password');
        
        res.json({ success: true, user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update profile' });
    }
};

// ============================================
// 6. LOGOUT USER
// ============================================
const logoutUser = (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    res.json({ message: 'Logged out' });
};

// Exporting items accurately to match routes map references
module.exports = {
    registerUser,
    loginUser,
    googleLoginUser,
    getMe,
    updateProfile,
    logoutUser
};