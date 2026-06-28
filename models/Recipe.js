const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
    recipeName: {
        type: String,
        required: true,
        trim: true
    },
    recipeImage: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Drink', 'Soup', 'Salad', 'Other']
    },
    cuisineType: {
        type: String,
        required: true,
        enum: ['Italian', 'Chinese', 'Mexican', 'Indian', 'Thai', 'Japanese', 'French', 'American', 'Mediterranean', 'Other']
    },
    difficultyLevel: {
        type: String,
        required: true,
        enum: ['Easy', 'Medium', 'Hard']
    },
    preparationTime: {
        type: Number,
        required: true,
        min: 1
    },
    ingredients: {
        type: [String],
        required: true
    },
    instructions: {
        type: [String],
        required: true
    },
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    authorName: {
        type: String,
        required: true
    },
    authorEmail: {
        type: String,
        required: true
    },
    likesCount: {
        type: Number,
        default: 0
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    favorites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isFeatured: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['published', 'draft', 'archived'],
        default: 'published'
    },
    price: {
        type: Number,
        default: 0,
        min: 0
    },
    isPremium: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Index for search
recipeSchema.index({ recipeName: 'text', category: 1, cuisineType: 1 });

module.exports = mongoose.model('Recipe', recipeSchema);