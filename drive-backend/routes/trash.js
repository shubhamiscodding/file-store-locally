const express = require('express');
const router = express.Router();
const trashController = require('../controllers/trashController');
const auth = require('../middleware/auth');
const { check } = require('express-validator');

// @route   POST /api/trash/move
// @desc    Move item to trash
// @access  Private
router.post('/move', [
  auth,
  check('type', 'Type must be "file" or "folder"').isIn(['file', 'folder']),
  check('id', 'Invalid ID').isMongoId()
], trashController.moveToTrash);

// @route   POST /api/trash/restore
// @desc    Restore item from trash
// @access  Private
router.post('/restore', [
  auth,
  check('type', 'Type must be "file" or "folder"').isIn(['file', 'folder']),
  check('id', 'Invalid ID').isMongoId()
], trashController.restoreFromTrash);

// @route   DELETE /api/trash/delete
// @desc    Permanently delete item
// @access  Private
router.delete('/delete', [
  auth,
  check('type', 'Type must be "file" or "folder"').isIn(['file', 'folder']),
  check('id', 'Invalid ID').isMongoId()
], trashController.permanentDelete);

// @route   DELETE /api/trash/empty
// @desc    Empty trash
// @access  Private
router.delete('/empty', auth, trashController.emptyTrash);

// @route   GET /api/trash
// @desc    Get trash items
// @access  Private
router.get('/', auth, trashController.getTrashItems);

module.exports = router;