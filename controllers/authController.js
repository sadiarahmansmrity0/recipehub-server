const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.registerUser = async (req, res) => {
    try {
        const { name, email, image, password } = req.body;
        
        // 1. Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).send({ message: 'User already exists' });

        // 2. Create user (in a real app, hash the password first!)
        const newUser = new User({ name, email, image });
        await newUser.save();

        // 3. Create JWT
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // 4. Send as HTTPOnly Cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
        }).send({ success: true });

    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};