const mongoose = require('mongoose');
const Recipe = require('./models/Recipe');
require('dotenv').config();

async function updateRecipePrices() {
    try {
        await mongoose.connect(process.env.DB_URI);
        console.log('Connected to MongoDB');

        // Update all recipes that don't have a price or have price 0
        const result = await Recipe.updateMany(
            { price: { $in: [null, 0] } },
            { $set: { price: 4.99, isPremium: true } }
        );

        console.log(`✅ Updated ${result.modifiedCount} recipes with price $4.99`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updateRecipePrices();