const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const adminController = require('../controllers/adminController');
const Payment = require('../models/Payment');

// All admin routes require authentication
router.use(verifyToken);

// Check admin role middleware
const checkAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// Routes
router.get('/stats', checkAdmin, adminController.getDashboardStats);
router.get('/users', checkAdmin, adminController.getAllUsers);
router.put('/users/:id/block', checkAdmin, adminController.toggleBlockUser);
router.delete('/users/:id', checkAdmin, adminController.deleteUser);
router.get('/reports', checkAdmin, adminController.getAllReports);
router.put('/reports/:id', checkAdmin, adminController.updateReportStatus);
router.get('/transactions', checkAdmin, async (req, res) => {
    try {
        const transactions = await Payment.find()
            .sort({ createdAt: -1 })
            .limit(100);
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ message: 'Failed to fetch transactions' });
    }
});

module.exports = router;