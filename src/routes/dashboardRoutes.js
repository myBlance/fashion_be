const express = require('express');
const router = express.Router();
const dashboardController = require('../Controller/dashboardController');

/**
 * @route   GET /api/admin/stats
 * @desc    Get dashboard statistics
 * @access  Admin
 */
router.get('/stats', dashboardController.getStats);

module.exports = router;
