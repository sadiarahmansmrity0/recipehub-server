const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept'],
}));

app.use(express.json());

// ============================================
// DATABASE CONNECTION
// ============================================
const uri = process.env.DB_URI;

if (!uri) {
    console.error('❌ DB_URI is missing in .env file!');
    process.exit(1);
}

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let db;
let recipeCollection;
let userCollection;
let favoritesCollection;
let reportsCollection;
let paymentsCollection;

async function connectDB() {
    try {
        await client.connect();
        db = client.db('recipehub');
        
        recipeCollection = db.collection('recipes');
        userCollection = db.collection('users');
        favoritesCollection = db.collection('favorites');
        reportsCollection = db.collection('reports');
        paymentsCollection = db.collection('payments');
        
        console.log('✅ MongoDB connected successfully!');
        
        // ✅ Check if recipes exist
        const count = await recipeCollection.countDocuments();
        console.log(`📊 Total recipes in database: ${count}`);
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

connectDB();

// ============================================
// GENERATE TOKEN
// ============================================
const generateToken = (userId) => {
    const payload = { userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
};

// ============================================
// VERIFY TOKEN MIDDLEWARE
// ============================================
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (decoded.exp < Date.now()) {
            return res.status(401).json({ message: 'Token expired' });
        }

        const user = await userCollection.findOne({ _id: new ObjectId(decoded.userId) });
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

const verifyUser = (req, res, next) => {
    if (req.user?.role !== 'user' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden - User access required' });
    }
    next();
};

const verifyAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden - Admin access required' });
    }
    next();
};

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is healthy' });
});

app.get('/', (req, res) => {
    res.json({ message: 'RecipeHub API is running' });
});

// ============================================
// DEBUG ROUTE - Check recipes
// ============================================
app.get('/api/debug/recipes', async (req, res) => {
    try {
        const count = await recipeCollection.countDocuments();
        const sample = await recipeCollection.find().limit(5).toArray();
        res.json({ 
            count, 
            sample: sample.map(r => ({ 
                name: r.recipeName, 
                id: r._id,
                isFeatured: r.isFeatured 
            }))
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// ============================================
// AUTH ROUTES
// ============================================

// ✅ REGISTER
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, image } = req.body;

        console.log('📝 Register attempt:', email);

        // Validate password
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z]).{6,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters with one uppercase and one lowercase letter'
            });
        }

        // Check if user exists
        const existing = await userCollection.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ 
                success: false,
                message: 'User already exists' 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const newUser = {
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            image: image || '',
            role: 'user',
            blocked: false,
            isPremium: false,
            recipeCount: 0,
            createdAt: new Date()
        };

        const result = await userCollection.insertOne(newUser);
        console.log('✅ User created:', result.insertedId);

        // Generate token
        const token = generateToken(result.insertedId.toString());

        // Return user data (without password)
        const userData = { ...newUser };
        delete userData.password;

        res.status(201).json({
            success: true,
            token,
            user: { ...userData, _id: result.insertedId }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Registration failed' 
        });
    }
});

// ✅ LOGIN
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('🔐 Login attempt:', email);

        // Find user
        const user = await userCollection.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if blocked
        if (user.blocked) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been blocked'
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate token
        const token = generateToken(user._id.toString());
        console.log('✅ Login successful:', email);

        // Return user data (without password)
        const userData = { ...user };
        delete userData.password;

        res.json({
            success: true,
            token,
            user: userData
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// ✅ GET CURRENT USER
app.get('/api/auth/me', verifyToken, async (req, res) => {
    try {
        const userData = { ...req.user };
        delete userData.password;
        res.json(userData);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ✅ LOGOUT
app.post('/api/auth/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// ============================================
// RECIPE ROUTES
// ============================================

// Get all recipes
app.get('/api/recipes', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const skip = (page - 1) * limit;

        const recipes = await recipeCollection.find({ status: 'published' })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .toArray();

        const total = await recipeCollection.countDocuments({ status: 'published' });

        res.json({
            recipes,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('Get recipes error:', error);
        res.status(500).json({ message: 'Failed to fetch recipes' });
    }
});

// Get featured recipes
app.get('/api/recipes/featured', async (req, res) => {
    try {
        const recipes = await recipeCollection.find({ isFeatured: true, status: 'published' })
            .limit(6)
            .toArray();
        res.json(recipes);
    } catch (error) {
        console.error('Get featured error:', error);
        res.json([]);
    }
});

// Get popular recipes
app.get('/api/recipes/popular', async (req, res) => {
    try {
        const recipes = await recipeCollection.find({ status: 'published' })
            .sort({ likesCount: -1 })
            .limit(6)
            .toArray();
        res.json(recipes);
    } catch (error) {
        console.error('Get popular error:', error);
        res.json([]);
    }
});

// Get single recipe
app.get('/api/recipes/:id', async (req, res) => {
    try {
        const recipe = await recipeCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }
        res.json(recipe);
    } catch (error) {
        console.error('Get recipe error:', error);
        res.status(500).json({ message: 'Failed to fetch recipe' });
    }
});

// Create recipe
app.post('/api/recipes', verifyToken, verifyUser, async (req, res) => {
    try {
        const user = req.user;

        if (!user.isPremium && user.role !== 'admin') {
            const count = await recipeCollection.countDocuments({ authorId: user._id.toString() });
            if (count >= 2) {
                return res.status(403).json({ message: 'Recipe limit reached. Upgrade to premium!' });
            }
        }

        const recipe = {
            ...req.body,
            authorId: user._id.toString(),
            authorName: user.name,
            authorEmail: user.email,
            likesCount: 0,
            likes: [],
            favorites: [],
            status: 'published',
            createdAt: new Date()
        };

        const result = await recipeCollection.insertOne(recipe);
        await userCollection.updateOne(
            { _id: new ObjectId(user._id) },
            { $inc: { recipeCount: 1 } }
        );

        res.status(201).json({ success: true, recipe: { ...recipe, _id: result.insertedId } });
    } catch (error) {
        console.error('Create recipe error:', error);
        res.status(500).json({ message: 'Failed to create recipe' });
    }
});

// ============================================
// START SERVER
// ============================================
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});