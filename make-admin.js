const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function makeAdmin() {
    try {
        await mongoose.connect(process.env.DB_URI);
        console.log('Connected to MongoDB');
        
        // Update user to admin
        const user = await User.findOneAndUpdate(
            { email: 'sadiarahmansmrity9@gmail.com' },
            { $set: { role: 'admin' } },
            { new: true }
        );
        
        if (user) {
            console.log(`✅ ${user.email} is now an admin!`);
            console.log('User role:', user.role);
        } else {
            console.log('❌ User not found');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

makeAdmin();