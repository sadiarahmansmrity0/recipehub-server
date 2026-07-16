require('dotenv').config();

console.log('🔑 STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✅ Loaded' : '❌ Missing');
console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET ? '✅ Loaded' : '❌ Missing');
console.log('🔑 DB_URI:', process.env.DB_URI ? '✅ Loaded' : '❌ Missing');

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ STRIPE_SECRET_KEY is missing!');
    process.exit(1);
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept'],
}));

app.use(express.json());
app.use(cookieParser());

// MongoDB
mongoose.connect(process.env.DB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB error:', err.message));

// ============================================
// SCHEMAS
// ============================================

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    image: String,
    role: { type: String, default: 'user' },
    isBlocked: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    premiumExpiry: Date,
    recipeCount: { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const recipeSchema = new mongoose.Schema({
    recipeName: String,
    recipeImage: String,
    category: String,
    cuisineType: String,
    difficultyLevel: String,
    preparationTime: Number,
    ingredients: [String],
    instructions: [String],
    authorId: mongoose.Schema.Types.ObjectId,
    authorName: String,
    authorEmail: String,
    likesCount: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isFeatured: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    price: { type: Number, default: 0 },
    status: { type: String, default: 'published' },
}, { timestamps: true });

const Recipe = mongoose.model('Recipe', recipeSchema);

// ✅ PAYMENT SCHEMA - For storing purchases
const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userEmail: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'usd' },
    transactionId: { type: String, required: true, unique: true },
    paymentStatus: { type: String, default: 'completed' },
    type: { type: String, enum: ['recipe', 'premium'], required: true },
    recipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
    paymentIntentId: { type: String },
    metadata: { type: Object, default: {} }
}, { timestamps: true });

const Payment = mongoose.model('Payment', paymentSchema);

// ============================================
// VERIFY TOKEN MIDDLEWARE
// ============================================

const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, image } = req.body;
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) return res.status(400).json({ message: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({
            name,
            email: email.toLowerCase(),
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
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

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
});

app.get('/api/auth/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    res.json({ message: 'Logged out' });
});

// ============================================
// ✅ UPDATE PROFILE
// ============================================

app.put('/api/auth/profile', verifyToken, async (req, res) => {
    try {
        const { name, image } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (name) user.name = name;
        if (image !== undefined) user.image = image;

        await user.save();

        const userData = user.toObject();
        delete userData.password;

        res.json({ success: true, user: userData });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Failed to update profile' });
    }
});

// ============================================
// RECIPE ROUTES
// ============================================

app.get('/api/recipes', async (req, res) => {
    try {
        const recipes = await Recipe.find({ status: 'published' });
        res.json(recipes);
    } catch (error) {
        res.json([]);
    }
});

app.get('/api/recipes/featured', async (req, res) => {
    try {
        const recipes = await Recipe.find({ isFeatured: true, status: 'published' }).limit(6);
        res.json(recipes);
    } catch (error) {
        res.json([]);
    }
});

app.get('/api/recipes/popular', async (req, res) => {
    try {
        const recipes = await Recipe.find({ status: 'published' }).sort({ likesCount: -1 }).limit(6);
        res.json(recipes);
    } catch (error) {
        res.json([]);
    }
});

app.get('/api/recipes/:id', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
        res.json(recipe);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching recipe' });
    }
});

app.post('/api/recipes', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.isPremium && user.role !== 'admin') {
            const count = await Recipe.countDocuments({ authorId: user._id });
            if (count >= 2) {
                return res.status(403).json({ message: 'Recipe limit reached. Upgrade to premium!' });
            }
        }

        const recipe = new Recipe({
            ...req.body,
            authorId: user._id,
            authorName: user.name,
            authorEmail: user.email,
        });
        await recipe.save();

        user.recipeCount = (user.recipeCount || 0) + 1;
        await user.save();

        res.status(201).json({ success: true, recipe });
    } catch (error) {
        console.error('Create recipe error:', error);
        res.status(500).json({ message: 'Failed to create recipe' });
    }
});

app.put('/api/recipes/:id', verifyToken, async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

        if (recipe.authorId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const updated = await Recipe.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, recipe: updated });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update recipe' });
    }
});

app.delete('/api/recipes/:id', verifyToken, async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

        if (recipe.authorId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await recipe.deleteOne();
        res.json({ success: true, message: 'Recipe deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete recipe' });
    }
});

app.post('/api/recipes/:id/like', verifyToken, async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

        const userId = req.user.id;
        const likeIndex = (recipe.likes || []).indexOf(userId);

        if (likeIndex === -1) {
            recipe.likes.push(userId);
            recipe.likesCount = (recipe.likesCount || 0) + 1;
        } else {
            recipe.likes.splice(likeIndex, 1);
            recipe.likesCount = (recipe.likesCount || 0) - 1;
        }

        await recipe.save();
        res.json({ success: true, likesCount: recipe.likesCount, isLiked: likeIndex === -1 });
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ message: 'Failed to toggle like' });
    }
});

app.post('/api/recipes/:id/favorite', verifyToken, async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

        const userId = req.user.id;
        const favIndex = (recipe.favorites || []).indexOf(userId);

        if (favIndex === -1) {
            recipe.favorites.push(userId);
        } else {
            recipe.favorites.splice(favIndex, 1);
        }

        await recipe.save();
        res.json({ success: true, isFavorited: favIndex === -1 });
    } catch (error) {
        console.error('Favorite error:', error);
        res.status(500).json({ message: 'Failed to toggle favorite' });
    }
});

app.get('/api/recipes/user/my-recipes', verifyToken, async (req, res) => {
    try {
        const recipes = await Recipe.find({ authorId: req.user.id });
        res.json(recipes);
    } catch (error) {
        res.json([]);
    }
});

app.get('/api/recipes/user/favorites', verifyToken, async (req, res) => {
    try {
        const recipes = await Recipe.find({ favorites: req.user.id });
        res.json(recipes);
    } catch (error) {
        res.json([]);
    }
});

app.put('/api/recipes/:id/feature', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

        recipe.isFeatured = !recipe.isFeatured;
        await recipe.save();
        res.json({ success: true, isFeatured: recipe.isFeatured });
    } catch (error) {
        res.status(500).json({ message: 'Failed to toggle feature' });
    }
});

// ============================================
// ✅ PAYMENT ROUTES
// ============================================

// Premium Checkout
app.post('/api/payment/premium', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.isPremium) return res.status(400).json({ message: 'Already premium' });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'RecipeHub Premium Membership',
                        description: 'Unlimited recipes and premium features',
                    },
                    unit_amount: 999,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.body.success_url || 'http://localhost:3000/dashboard/premium/success'}`,
            cancel_url: req.body.cancel_url || 'http://localhost:3000/dashboard/premium',
            customer_email: user.email,
            metadata: { userId: user._id.toString(), type: 'premium' }
        });

        res.json({ success: true, url: session.url });
    } catch (error) {
        console.error('Premium error:', error);
        res.status(500).json({ message: 'Failed to create checkout' });
    }
});

// ✅ ACTIVATE PREMIUM - DIRECT FROM SUCCESS PAGE
app.post('/api/payment/activate-premium', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        console.log('🔄 DIRECT ACTIVATION for:', user.email);
        console.log('📊 Current isPremium:', user.isPremium);

        if (user.isPremium) {
            return res.json({ success: true, message: 'Already premium', alreadyPremium: true });
        }

        user.isPremium = true;
        user.premiumExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        await user.save();

        console.log('✅ PREMIUM ACTIVATED for:', user.email);

        res.json({ 
            success: true, 
            message: 'Premium activated successfully',
            user: {
                id: user._id,
                email: user.email,
                isPremium: user.isPremium
            }
        });
    } catch (error) {
        console.error('❌ Activation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to activate premium'
        });
    }
});

// ✅ RECIPE PURCHASE - Saves purchase
app.post('/api/payment/recipe', verifyToken, async (req, res) => {
    try {
        const { recipeId, success_url, cancel_url } = req.body;
        const recipe = await Recipe.findById(recipeId);
        if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
        
        if (recipe.price <= 0) {
            return res.status(400).json({ message: 'This recipe is free' });
        }

        // ✅ Check if user already purchased this recipe
        const existingPurchase = await Payment.findOne({
            userId: req.user.id,
            recipeId: recipe._id,
            paymentStatus: 'completed'
        });

        if (existingPurchase) {
            return res.status(400).json({ message: 'You already purchased this recipe' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { 
                        name: recipe.recipeName,
                        description: `Recipe by ${recipe.authorName}`
                    },
                    unit_amount: Math.round(recipe.price * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: success_url || `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/purchased?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancel_url || `${process.env.CLIENT_URL || 'http://localhost:3000'}/recipes/${recipeId}`,
            customer_email: req.user.email,
            metadata: { 
                userId: req.user.id, 
                recipeId: recipe._id.toString(), 
                type: 'recipe' 
            }
        });

        res.json({ success: true, url: session.url });
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ message: 'Failed to create purchase session' });
    }
});

// ============================================
// ✅ VERIFY PURCHASE - Direct verification
// ============================================

app.post('/api/payment/verify-purchase', verifyToken, async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        console.log('🔍 Verifying purchase for session:', sessionId);

        if (!sessionId) {
            return res.status(400).json({ success: false, message: 'No session ID provided' });
        }

        // ✅ Check if payment already exists in database
        const existingPayment = await Payment.findOne({ transactionId: sessionId });
        if (existingPayment) {
            console.log('✅ Payment already exists:', sessionId);
            return res.json({ 
                success: true, 
                alreadyPurchased: true,
                recipeId: existingPayment.recipeId
            });
        }

        // ✅ Verify with Stripe
        let session;
        try {
            session = await stripe.checkout.sessions.retrieve(sessionId);
            console.log('📦 Stripe session status:', session.payment_status);
        } catch (err) {
            console.error('❌ Stripe session retrieve error:', err.message);
            return res.status(400).json({ success: false, message: 'Invalid session ID' });
        }
        
        if (session.payment_status === 'paid') {
            // ✅ Save payment
            const payment = new Payment({
                userId: req.user.id,
                userEmail: session.customer_email || req.user.email,
                amount: session.amount_total / 100,
                currency: session.currency || 'usd',
                transactionId: session.id,
                paymentStatus: 'completed',
                type: 'recipe',
                recipeId: session.metadata?.recipeId,
                paymentIntentId: session.payment_intent,
                metadata: session.metadata || {}
            });
            
            await payment.save();
            console.log('✅ Payment saved:', sessionId);
            
            return res.json({ 
                success: true, 
                recipeId: session.metadata?.recipeId 
            });
        }

        res.json({ success: false, message: 'Payment not completed' });
    } catch (error) {
        console.error('❌ Verify purchase error:', error);
        res.status(500).json({ success: false, message: 'Verification failed' });
    }
});

// ✅ GET PURCHASED RECIPES
app.get('/api/payment/purchased', verifyToken, async (req, res) => {
    try {
        const payments = await Payment.find({
            userId: req.user.id,
            paymentStatus: 'completed',
            type: 'recipe'
        });

        const recipeIds = payments.map(p => p.recipeId).filter(id => id);
        
        if (recipeIds.length === 0) {
            return res.json([]);
        }

        const recipes = await Recipe.find({
            _id: { $in: recipeIds },
            status: 'published'
        });

        res.json(recipes);
    } catch (error) {
        console.error('Get purchased error:', error);
        res.json([]);
    }
});

// ============================================
// ✅ REPORT ROUTES
// ============================================

// Create a report
app.post('/api/reports', verifyToken, async (req, res) => {
    try {
        const { recipeId, reason, description } = req.body;

        if (!recipeId || !reason) {
            return res.status(400).json({ message: 'Recipe ID and reason are required' });
        }

        const recipe = await Recipe.findById(recipeId);
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        console.log(`📝 Report submitted for recipe ${recipeId}: ${reason}`);

        res.status(201).json({ 
            success: true, 
            message: 'Report submitted successfully' 
        });
    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ message: 'Failed to submit report' });
    }
});

// Get reports (admin only)
app.get('/api/reports', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        res.json([]);
    } catch (error) {
        res.json([]);
    }
});

// ============================================
// ADMIN ROUTES
// ============================================

app.get('/api/admin/stats', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        const totalUsers = await User.countDocuments();
        const totalRecipes = await Recipe.countDocuments();
        const totalPremium = await User.countDocuments({ isPremium: true });
        res.json({ totalUsers, totalRecipes, totalPremium, totalReports: 0 });
    } catch (error) {
        res.status(500).json({ message: 'Failed to get stats' });
    }
});

app.get('/api/admin/users', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to get users' });
    }
});

app.put('/api/admin/users/:id/block', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.isBlocked = !user.isBlocked;
        await user.save();
        res.json({ success: true, isBlocked: user.isBlocked });
    } catch (error) {
        res.status(500).json({ message: 'Failed to block user' });
    }
});

// ============================================
// HEALTH & ROOT
// ============================================

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is healthy' });
});

app.get('/', (req, res) => {
    res.json({ message: 'RecipeHub API running' });
});

app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});