const mongoose = require('mongoose');
const User = require('./models/User');
const Recipe = require('./models/Recipe');
require('dotenv').config();

const sampleRecipes = [
    {
        recipeName: "Classic Spaghetti Carbonara",
        recipeImage: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=500",
        category: "Dinner",
        cuisineType: "Italian",
        difficultyLevel: "Medium",
        preparationTime: 30,
        ingredients: ["400g spaghetti", "4 large eggs", "100g pecorino cheese", "100g pancetta", "Black pepper to taste"],
        instructions: ["Cook pasta in salted water until al dente", "Fry pancetta with garlic until crispy", "Beat eggs with cheese and pepper", "Combine pasta with pancetta, then add egg mixture", "Stir quickly until creamy"],
        isFeatured: true,
        isPremium: false,
        price: 0,
        status: "published"
    },
    {
        recipeName: "Chicken Tikka Masala",
        recipeImage: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500",
        category: "Dinner",
        cuisineType: "Indian",
        difficultyLevel: "Hard",
        preparationTime: 60,
        ingredients: ["500g chicken breast", "1 cup yogurt", "2 tbsp garam masala", "1 onion", "2 cloves garlic", "1 cup tomato puree", "1 cup heavy cream"],
        instructions: ["Marinate chicken in yogurt and spices for 2 hours", "Grill chicken until charred", "Sauté onions and garlic", "Add tomato puree and cream", "Add grilled chicken and simmer"],
        isFeatured: true,
        isPremium: false,
        price: 0,
        status: "published"
    },
    {
        recipeName: "Japanese Sushi Roll",
        recipeImage: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500",
        category: "Lunch",
        cuisineType: "Japanese",
        difficultyLevel: "Hard",
        preparationTime: 45,
        ingredients: ["2 cups sushi rice", "Nori sheets", "Fresh salmon", "Cucumber", "Avocado", "Soy sauce"],
        instructions: ["Cook and season sushi rice", "Place nori on bamboo mat", "Spread rice evenly", "Add fillings in a line", "Roll tightly and slice"],
        isFeatured: true,
        isPremium: false,
        price: 0,
        status: "published"
    },
    {
        recipeName: "Chocolate Lava Cake",
        recipeImage: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500",
        category: "Dessert",
        cuisineType: "French",
        difficultyLevel: "Medium",
        preparationTime: 20,
        ingredients: ["100g dark chocolate", "100g butter", "2 eggs", "50g sugar", "50g flour"],
        instructions: ["Melt chocolate and butter together", "Beat eggs and sugar until fluffy", "Fold in melted chocolate", "Add flour and mix", "Bake at 200°C for 12 minutes"],
        isFeatured: false,
        isPremium: true,
        price: 4.99,
        status: "published"
    },
    {
        recipeName: "Pumpkin Soup",
        recipeImage: "https://images.unsplash.com/photo-1550305080-4e029753abcf?w=500",
        category: "Soup",
        cuisineType: "American",
        difficultyLevel: "Easy",
        preparationTime: 35,
        ingredients: ["1 pumpkin", "1 onion", "2 cloves garlic", "2 cups vegetable broth", "1/2 cup cream", "Salt and pepper"],
        instructions: ["Roast pumpkin until soft", "Sauté onion and garlic", "Add roasted pumpkin and broth", "Blend until smooth", "Add cream and season"],
        isFeatured: false,
        isPremium: true,
        price: 3.99,
        status: "published"
    },
    {
        recipeName: "Mexican Beef Tacos",
        recipeImage: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=500",
        category: "Dinner",
        cuisineType: "Mexican",
        difficultyLevel: "Easy",
        preparationTime: 25,
        ingredients: ["Tortillas", "500g beef", "Lettuce", "Tomatoes", "Cheese", "Salsa"],
        instructions: ["Cook beef with spices", "Warm tortillas", "Assemble tacos with toppings", "Serve with salsa"],
        isFeatured: false,
        isPremium: true,
        price: 5.99,
        status: "published"
    }
];

async function seedRecipes() {
    try {
        await mongoose.connect(process.env.DB_URI);
        console.log('Connected to MongoDB');

        // Find a REGULAR user (not admin)
        const user = await User.findOne({ role: 'user' });
        
        if (!user) {
            console.log('❌ No regular user found. Please create a regular user first!');
            console.log('Tip: Register a new user with email/password');
            process.exit(1);
        }

        console.log(`👤 Using user: ${user.name} (${user.email}) - Role: ${user.role}`);

        // Clear existing recipes
        await Recipe.deleteMany({});
        console.log('🗑️ Cleared existing recipes');

        // Add author info to each recipe
        const recipesWithAuthor = sampleRecipes.map(recipe => ({
            ...recipe,
            authorId: user._id,
            authorName: user.name,
            authorEmail: user.email
        }));

        // Insert recipes
        const result = await Recipe.insertMany(recipesWithAuthor);
        console.log(`✅ Added ${result.length} sample recipes!`);

        // Update user's recipe count
        user.recipeCount = result.length;
        await user.save();
        console.log(`📊 Updated user recipe count to ${user.recipeCount}`);

        console.log('\n📋 Recipe Summary:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        result.forEach((r, i) => {
            console.log(`${i+1}. ${r.recipeName}`);
            console.log(`   Category: ${r.category} | Cuisine: ${r.cuisineType}`);
            console.log(`   Premium: ${r.isPremium ? '✅' : '❌'} | Price: $${r.price || 0}`);
            console.log(`   Featured: ${r.isFeatured ? '✅' : '❌'}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        });

        console.log('\n🎉 Sample data added successfully!');
        console.log('💡 Tip: Login as a regular user to see recipes');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding recipes:', error);
        process.exit(1);
    }
}

seedRecipes();