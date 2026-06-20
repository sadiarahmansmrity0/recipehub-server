const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db'); // Import the DB function
const authRoutes = require('./routes/authRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const app = express();
connectDB();
// 1. Middleware for CORS
app.use(cors({
    origin: [
        'http://localhost:5173', 
        'https://your-live-site-url.com' // replace this once  deploy
    ],
    credentials: true // Enables cookies to be sent/received
}));

// 2. Middleware for parsing data

app.use(express.json());
app.use(cookieParser());
app.use('/auth', authRoutes);
app.use('/recipes', recipeRoutes);
// --- ROUTES GO BELOW HERE ---
app.get('/', (req, res) => {
    res.send('RecipeHub Server is running!');
});

app.listen(5000, () => {
    console.log('Server is running on port 5000');
});
// Backend route
app.get('/recipes', async (req, res) => {
    const recipes = await Recipe.find(); // Fetch from MongoDB
    res.send(recipes);
});