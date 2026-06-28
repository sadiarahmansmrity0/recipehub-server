const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const Report = require('../models/Report');

// Create a report (protected)
router.post('/', verifyToken, async (req, res) => {
    try {
        const { recipeId, reason, description } = req.body;

        // Validate required fields
        if (!recipeId || !reason) {
            return res.status(400).json({ 
                message: 'Recipe ID and reason are required' 
            });
        }

        // Check if user already reported this recipe
        const existingReport = await Report.findOne({
            recipeId,
            reporterId: req.user.id,
            status: 'pending'
        });

        if (existingReport) {
            return res.status(400).json({ 
                message: 'You have already reported this recipe' 
            });
        }

        // Create report
        const report = new Report({
            recipeId,
            reporterId: req.user.id,
            reporterEmail: req.user.email,
            reason,
            description: description || ''
        });

        await report.save();

        res.status(201).json({ 
            success: true, 
            message: 'Report submitted successfully',
            report 
        });
    } catch (error) {
        console.error('Report creation error:', error);
        res.status(500).json({ 
            message: 'Failed to submit report' 
        });
    }
});

module.exports = router;