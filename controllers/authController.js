const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');

// Register User
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, image } = req.body;

        console.log('Register attempt:', { name, email });

        // Validate password
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z]).{6,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: 'Password must be at least 6 characters and contain one uppercase and one lowercase letter'
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password
        console.log('Hashing password...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log('Password hashed successfully');

        // Create user with hashed password
        const newUser = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            image: image || ''
        });

        await newUser.save();
        console.log('User created successfully:', newUser._id);

        // Generate JWT
        const token = jwt.sign(
            { id: newUser._id, email: newUser.email, role: newUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // ✅ FIX: Cookie settings for production
        const isProduction = process.env.NODE_ENV === 'production';
        
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            // ✅ Add domain for production
            ...(isProduction && { domain: process.env.COOKIE_DOMAIN || undefined })
        });

        // Return user data
        const userData = newUser.toObject();
        delete userData.password;

        res.status(201).json({
            success: true,
            user: userData
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ 
            message: 'Registration failed. Please try again.'
        });
    }
};

// Login User
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('Login attempt for:', email);

        if (!email || !password) {
            return res.status(400).json({ 
                message: 'Email and password are required' 
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.log('User not found:', email);
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (user.isBlocked) {
            console.log('User is blocked:', email);
            return res.status(403).json({ message: 'Your account has been blocked' });
        }

        // Compare password using bcrypt
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match result:', isMatch);
        
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // ✅ FIX: Cookie settings for production
        const isProduction = process.env.NODE_ENV === 'production';
        
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            ...(isProduction && { domain: process.env.COOKIE_DOMAIN || undefined })
        });

        const userData = user.toObject();
        delete userData.password;

        console.log('Login successful for:', email);
        res.json({ 
            success: true, 
            user: userData 
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            message: 'Login failed. Please try again.'
        });
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

// Logout User
exports.logoutUser = async (req, res) => {
    try {
        // ✅ FIX: Clear cookie with proper settings
        const isProduction = process.env.NODE_ENV === 'production';
        
        res.clearCookie('token', {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            ...(isProduction && { domain: process.env.COOKIE_DOMAIN || undefined })
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
        
        console.log('Google login attempt');

        if (!token) {
            return res.status(400).json({ message: 'Google token required' });
        }

        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        
        // Verify Google token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        const { email, name, picture } = payload;
        
        console.log('Google user:', { email, name });

        if (!email) {
            return res.status(400).json({ message: 'Email not found from Google' });
        }

        // Check if user exists
        let user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            console.log('Creating new user from Google login');
            // Create new user
            user = new User({
                name: name || email.split('@')[0],
                email: email.toLowerCase(),
                image: picture || '',
                password: Math.random().toString(36).slice(-8) + 'Aa1!',
                isGoogleUser: true
            });
            await user.save();
            console.log('User created:', user._id);
        }

        // Generate JWT
        const jwtToken = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // ✅ FIX: Cookie settings for production
        const isProduction = process.env.NODE_ENV === 'production';
        
        res.cookie('token', jwtToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            ...(isProduction && { domain: process.env.COOKIE_DOMAIN || undefined })
        });
        
        const userData = user.toObject();
        delete userData.password;
        
        console.log('Google login successful for:', email);
        res.json({ success: true, user: userData });
        
    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({ 
            message: 'Google login failed',
            error: error.message 
        });
    }
};