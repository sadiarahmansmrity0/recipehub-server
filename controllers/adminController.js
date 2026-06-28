const User = require('../models/User');
const Recipe = require('../models/Recipe');
const Report = require('../models/Report');
const Payment = require('../models/Payment');

// Dashboard Stats
exports.getDashboardStats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const totalUsers = await User.countDocuments();
        const totalRecipes = await Recipe.countDocuments();
        const totalPremium = await User.countDocuments({ isPremium: true });
        const totalReports = await Report.countDocuments({ status: 'pending' });

        res.json({
            totalUsers,
            totalRecipes,
            totalPremium,
            totalReports
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ message: 'Failed to fetch stats' });
    }
};

// Get All Users (Admin)
exports.getAllUsers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
};

// Block/Unblock User
exports.toggleBlockUser = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Don't allow blocking yourself
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({ message: 'Cannot block yourself' });
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.json({ success: true, isBlocked: user.isBlocked });

    } catch (error) {
        console.error('Toggle block error:', error);
        res.status(500).json({ message: 'Failed to toggle block status' });
    }
};

// Get All Reports (Admin)
exports.getAllReports = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const reports = await Report.find()
            .populate('recipeId', 'recipeName authorName')
            .populate('reporterId', 'name email')
            .sort({ createdAt: -1 });

        res.json(reports);

    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ message: 'Failed to fetch reports' });
    }
};

// Update Report Status
exports.updateReportStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const { status } = req.body;
        const report = await Report.findById(req.params.id);

        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        report.status = status;
        await report.save();

        // If resolved, delete the recipe
        if (status === 'resolved') {
            await Recipe.findByIdAndDelete(report.recipeId);
        }

        res.json({ success: true, report });

    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({ message: 'Failed to update report' });
    }
};
// Delete User (Admin)
exports.deleteUser = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Don't allow deleting yourself
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({ message: 'Cannot delete yourself' });
        }

        // Delete user's recipes
        await Recipe.deleteMany({ authorId: user._id });
        
        // Delete user's favorites
        await Recipe.updateMany(
            { favorites: user._id },
            { $pull: { favorites: user._id } }
        );

        // Delete the user
        await user.deleteOne();

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Failed to delete user' });
    }
};