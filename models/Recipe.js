const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
    recipeName: String,
    recipeImage: String,
    category: String,
    cuisine: String,
    authorName: String,
    // Add other fields from  requirement list later
}, { timestamps: true });

module.exports = mongoose.model('Recipe', recipeSchema);