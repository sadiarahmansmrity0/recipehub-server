const Recipe = require('../models/Recipe');
const User = require('../models/User');

// Create Recipe
exports.createRecipe = async (req, res) => {
    try {
        const {
            recipeName,
            recipeImage,
            category,
            cuisineType,
            difficultyLevel,
            preparationTime,
            ingredients,
            instructions,
            price,
            isPremium
        } = req.body;

        // Get user
        const user = await User.findById(req.user.id);
        
        // Check recipe limit - EXEMPT ADMIN
        const recipeCount = await Recipe.countDocuments({ authorId: req.user.id });
        
        // Admin can create unlimited recipes, regular users are limited to 2
        if (user.role !== 'admin' && !user.isPremium && recipeCount >= 2) {
            return res.status(403).json({ 
                message: 'You have reached the maximum limit of 2 recipes. Please upgrade to premium for unlimited recipes.' 
            });
        }

        // Create recipe
        const recipe = new Recipe({
            recipeName: recipeName.trim(),
            recipeImage: recipeImage || 'https://via.placeholder.com/400x300/FF6B35/FFFFFF?text=Recipe',
            category,
            cuisineType,
            difficultyLevel,
            preparationTime: parseInt(preparationTime),
            ingredients: ingredients || [],
            instructions: instructions || [],
            authorId: req.user.id,
            authorName: user.name,
            authorEmail: user.email,
            price: price || 0,
            isPremium: isPremium || false
        });

        await recipe.save();

        // Update user's recipe count
        user.recipeCount += 1;
        await user.save();

        res.status(201).json({ success: true, recipe });

    } catch (error) {
        console.error('Create recipe error:', error);
        res.status(500).json({ 
            message: 'Failed to create recipe',
            error: error.message 
        });
    }
};

// Get All Recipes with Pagination & Filters
exports.getAllRecipes = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const skip = (page - 1) * limit;
        const category = req.query.category;
        const cuisine = req.query.cuisine;
        const search = req.query.search;

        let filter = { status: 'published' };

        if (category) filter.category = category;
        if (cuisine) filter.cuisineType = cuisine;
        if (search) {
            filter.$or = [
                { recipeName: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }

        const recipes = await Recipe.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('authorId', 'name email image');

        const total = await Recipe.countDocuments(filter);

        res.json({
            recipes,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get recipes error:', error);
        res.status(500).json({ message: 'Failed to fetch recipes' });
    }
};

// Get Featured Recipes
exports.getFeaturedRecipes = async (req, res) => {
    try {
        const recipes = await Recipe.find({ isFeatured: true, status: 'published' })
            .limit(6)
            .populate('authorId', 'name image');
        res.json(recipes);
    } catch (error) {
        console.error('Get featured error:', error);
        res.status(500).json({ message: 'Failed to fetch featured recipes' });
    }
};

// Get Popular Recipes
exports.getPopularRecipes = async (req, res) => {
    try {
        const recipes = await Recipe.find({ status: 'published' })
            .sort({ likesCount: -1 })
            .limit(6)
            .populate('authorId', 'name image');
        res.json(recipes);
    } catch (error) {
        console.error('Get popular error:', error);
        res.status(500).json({ message: 'Failed to fetch popular recipes' });
    }
};

// Get Single Recipe
exports.getRecipeById = async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id)
            .populate('authorId', 'name email image isPremium');

        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        // Ensure authorId is properly formatted
        const recipeData = recipe.toObject();
        if (recipeData.authorId && typeof recipeData.authorId === 'object') {
            // Already populated, keep as is
        }

        res.json(recipeData);
    } catch (error) {
        console.error('Get recipe error:', error);
        res.status(500).json({ message: 'Failed to fetch recipe' });
    }
};

// Update Recipe
exports.updateRecipe = async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);

        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        // Check if user is author or admin
        if (recipe.authorId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to update this recipe' });
        }

        const updatedRecipe = await Recipe.findByIdAndUpdate(
            req.params.id,
            { ...req.body },
            { new: true, runValidators: true }
        );

        res.json({ success: true, recipe: updatedRecipe });

    } catch (error) {
        console.error('Update recipe error:', error);
        res.status(500).json({ message: 'Failed to update recipe' });
    }
};

// Delete Recipe
exports.deleteRecipe = async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);

        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        // Check if user is author or admin
        if (recipe.authorId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to delete this recipe' });
        }

        await recipe.deleteOne();

        // Decrease user's recipe count
        await User.findByIdAndUpdate(req.user.id, { $inc: { recipeCount: -1 } });

        res.json({ success: true, message: 'Recipe deleted successfully' });

    } catch (error) {
        console.error('Delete recipe error:', error);
        res.status(500).json({ message: 'Failed to delete recipe' });
    }
};

// Like/Unlike Recipe
exports.toggleLike = async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);

        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        const userId = req.user.id;
        const likeIndex = recipe.likes.indexOf(userId);

        if (likeIndex === -1) {
            // Like
            recipe.likes.push(userId);
            recipe.likesCount += 1;
        } else {
            // Unlike
            recipe.likes.splice(likeIndex, 1);
            recipe.likesCount -= 1;
        }

        await recipe.save();
        res.json({ success: true, likesCount: recipe.likesCount, isLiked: likeIndex === -1 });

    } catch (error) {
        console.error('Toggle like error:', error);
        res.status(500).json({ message: 'Failed to toggle like' });
    }
};

// Toggle Favorite
exports.toggleFavorite = async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);

        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        const userId = req.user.id;
        const favIndex = recipe.favorites.indexOf(userId);

        if (favIndex === -1) {
            recipe.favorites.push(userId);
        } else {
            recipe.favorites.splice(favIndex, 1);
        }

        await recipe.save();
        res.json({ 
            success: true, 
            isFavorited: favIndex === -1 
        });

    } catch (error) {
        console.error('Toggle favorite error:', error);
        res.status(500).json({ message: 'Failed to toggle favorite' });
    }
};

// Get User's Recipes
exports.getUserRecipes = async (req, res) => {
    try {
        const recipes = await Recipe.find({ authorId: req.user.id })
            .sort({ createdAt: -1 });
        res.json(recipes);
    } catch (error) {
        console.error('Get user recipes error:', error);
        res.status(500).json({ message: 'Failed to fetch user recipes' });
    }
};

// Get User's Favorite Recipes
exports.getUserFavorites = async (req, res) => {
    try {
        const recipes = await Recipe.find({ 
            favorites: req.user.id,
            status: 'published'
        }).populate('authorId', 'name image');
        res.json(recipes);
    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({ message: 'Failed to fetch favorites' });
    }
};

// Admin: Feature/Unfeature Recipe
exports.toggleFeature = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        recipe.isFeatured = !recipe.isFeatured;
        await recipe.save();

        res.json({ success: true, isFeatured: recipe.isFeatured });

    } catch (error) {
        console.error('Toggle feature error:', error);
        res.status(500).json({ message: 'Failed to toggle feature' });
    }
};