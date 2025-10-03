const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const auth = require('../middleware/auth');
const { check } = require('express-validator');

// @route   POST /api/folders
// @desc    Create folder
// @access  Private
router.post('/', [
  auth,
  check('name', 'Name is required').not().isEmpty(),
], folderController.createFolder);

// @route   GET /api/folders
// @desc    Get user folders
// @access  Private
router.get('/', auth, folderController.getFolders);

// @route   GET /api/folders/:folderId
// @desc    Get folder details
// @access  Private
router.get('/:folderId', [
  auth,
  check('folderId', 'Invalid folder ID').isMongoId()
], folderController.getFolder);

// @route   PUT /api/folders/:folderId
// @desc    Update folder
// @access  Private
router.put('/:folderId', [
  auth,
  check('folderId', 'Invalid folder ID').isMongoId(),
  check('name', 'Name is required').optional().not().isEmpty()
], folderController.updateFolder);

// @route   DELETE /api/folders/:folderId
// @desc    Delete folder
// @access  Private
router.delete('/:folderId', [
  auth,
  check('folderId', 'Invalid folder ID').isMongoId()
], folderController.deleteFolder);

module.exports = router;