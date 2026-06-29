const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');

// Register User
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, image } = req.body;

        console.log('Register attempt:', { name, email });

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z]).{6,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: 'Password must be at least 6 characters with one uppercase and one lowercase letter'
            });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            image: image || ''
        });

        await newUser.save();
        console.log('User created:', newUser._id);

        const token = jwt.sign(
            { id: newUser._id, email: newUser.email, role: newUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        const userData = newUser.toObject();
        delete userData.password;

        res.status(201).json({ success: true, user: userData });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Registration failed' });
    }
};

// Login User
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('Login attempt:', email);

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (user.isBlocked) {
            return res.status(403).json({ message: 'Your account has been blocked' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        const userData = user.toObject();
        delete userData.password;

        console.log('Login successful:', email);
        res.json({ success: true, user: userData });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Login failed' });
    }
};

// Get Current User
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Logout
exports.logoutUser = async (req, res) => {
    try {
        const isProduction = process.env.NODE_ENV === 'production';
        res.clearCookie('token', {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/',
        });
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Logout failed' });
    }
};

// Update Profile
exports.updateProfile = async (req, res) => {
    try {
        const { name, image } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (name) user.name = name;
        if (image) user.image = image;

        await user.save();

        const userData = user.toObject();
        delete userData.password;

        res.json({ success: true, user: userData });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Update failed' });
    }
};

// Google Login
exports.googleLogin = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Google token required' });
        }

        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        let user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            const randomPassword = Math.random().toString(36).slice(-8) + 'Aa1!';
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);

            user = new User({
                name: name || email.split('@')[0],
                email: email.toLowerCase(),
                image: picture || '',
                password: hashedPassword,
                isGoogleUser: true
            });
            await user.save();
        }

        const jwtToken = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('token', jwtToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        const userData = user.toObject();
        delete userData.password;

        res.json({ success: true, user: userData });

    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({ message: 'Google login failed' });
    }
};