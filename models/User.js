const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        lowercase: true,
        trim: true
    },
    password: { 
        type: String, 
        required: true
    },
    image: { 
        type: String,
        default: ''
    },
    role: { 
        type: String, 
        enum: ['user', 'admin'], 
        default: 'user' 
    },
    isBlocked: { 
        type: Boolean, 
        default: false 
    },
    isPremium: { 
        type: Boolean, 
        default: false 
    },
    premiumExpiry: {
        type: Date,
        default: null
    },
    recipeCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// NO PRE-SAVE HOOK - Hashing is done in the controller

module.exports = mongoose.model('User', userSchema);