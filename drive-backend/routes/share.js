const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const auth = require('../middleware/auth');
const { check } = require('express-validator');

// @route   POST /api/share
// @desc    Generate share link
// @access  Private
router.post('/', [
  auth,
  check('fileId', 'Invalid file ID').isMongoId(),
  check('expiresIn', 'Invalid expiration days').optional({ checkFalsy: true }).isInt({ min: 1 }),
  check('password', 'Password must be at least 6 characters').optional().isLength({ min: 6 })
], shareController.generateShareLink);

// @route   GET /api/share
// @desc    Get user's share links
// @access  Private
router.get('/', auth, shareController.getShareLinks);

// @route   GET /api/share/:token
// @desc    Redirects user to the frontend share page
// @access  Public
router.get('/:token', shareController.accessSharedFile);

// @route   GET /api/share/:token/info
// @desc    Get public metadata for a shared file
// @access  Public
router.get('/:token/info', shareController.getShareInfo);

// @route   POST /api/share/:token/download
// @desc    Download shared file (now a POST to handle passwords)
// @access  Public
router.post('/:token/download', [
    // This validation is optional as the controller handles a missing password
    check('password').optional().isString()
], shareController.downloadSharedFile);

// @route   DELETE /api/share/:shareId
// @desc    Revoke share link
// @access  Private
router.delete('/:shareId', [
  auth,
  check('shareId', 'Invalid share ID').isMongoId()
], shareController.revokeShareLink);

// Note: The old '/:token/access' and '/:token/download' (GET) routes have been removed 
// as their logic is now handled by the routes above.

module.exports = router;