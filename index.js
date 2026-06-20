const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db'); // Import the DB function
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

// --- ROUTES GO BELOW HERE ---
app.get('/', (req, res) => {
    res.send('RecipeHub Server is running!');
});

app.listen(5000, () => {
    console.log('Server is running on port 5000');
});