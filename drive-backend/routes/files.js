const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { upload, handleUploadErrors, validateFilePresence } = require('../middleware/upload');
const auth = require('../middleware/auth');
const { check } = require('express-validator');

// Validation middleware
const validateUpload = [
  check('name', 'Name must be between 1 and 255 characters').optional().isLength({ min: 1, max: 255 }),
  check('folderId', 'Invalid folder ID').optional().isMongoId(),
  check('description', 'Description must be less than 500 characters').optional().isLength({ max: 500 })
];

const validateFileId = [
  check('fileId', 'Invalid file ID').isMongoId()
];

const validateRename = [
  check('name', 'Name is required and must be between 1-255 characters').isLength({ min: 1, max: 255 }).trim(),
  check('description', 'Description must be less than 500 characters').optional().isLength({ max: 500 })
];

const validateMove = [
  check('folderId', 'Invalid folder ID').optional().isMongoId()
];

// @route   POST /api/files/upload
// @desc    Upload file
// @access  Private
router.post('/upload', [
  auth,
  upload.single('file'),
  handleUploadErrors,
  validateFilePresence,
  ...validateUpload
], fileController.uploadFile);

// @route   GET /api/files
// @desc    Get user files with optional filtering and pagination
// @access  Private
router.get('/', [
  auth,
  check('page', 'Page must be a positive integer').optional().isInt({ min: 1 }),
  check('limit', 'Limit must be between 1-100').optional().isInt({ min: 1, max: 100 }),
  check('folderId', 'Invalid folder ID').optional().isMongoId(),
  check('type', 'Invalid file type filter').optional().isIn(['image', 'document', 'video', 'audio', 'other']),
  check('search', 'Search query must be less than 100 characters').optional().isLength({ max: 100 })
], fileController.getFiles);

// @route   GET /api/files/:fileId
// @desc    Get file metadata
// @access  Private
router.get('/:fileId', [
  auth,
  ...validateFileId
], fileController.getFile);

// @route   GET /api/files/:fileId/download
// @desc    Download file
// @access  Private
router.get('/:fileId/download', [
  auth,
  ...validateFileId
], fileController.downloadFile);

// @route   PUT /api/files/:fileId/rename
// @desc    Rename file
// @access  Private
router.put('/:fileId/rename', [
  auth,
  ...validateFileId,
  ...validateRename
], fileController.renameFile);

// @route   PUT /api/files/:fileId/move
// @desc    Move file to different folder
// @access  Private
router.put('/:fileId/move', [
  auth,
  ...validateFileId,
  ...validateMove
], fileController.moveFile);

// @route   PUT /api/files/:fileId/remove-from-folder
// @desc    Remove file from folder (move to root)
// @access  Private
router.put('/:fileId/remove-from-folder', [
  auth,
  ...validateFileId
], fileController.removeFromFolder);

// @route   DELETE /api/files/:fileId
// @desc    Delete file permanently
// @access  Private
router.delete('/:fileId', [
  auth,
  ...validateFileId
], fileController.deleteFile);

// @route   PUT /api/files/:fileId/share
// @desc    Share/unshare file
// @access  Private
router.put('/:fileId/share', [
  auth,
  ...validateFileId,
  check('isPublic', 'isPublic must be a boolean').isBoolean()
], fileController.toggleFileSharing);

// @route   GET /api/files/shared/:shareToken
// @desc    Get shared file (public access)
// @access  Public
router.get('/shared/:shareToken', [
  check('shareToken', 'Share token is required').notEmpty()
], fileController.getSharedFile);

// @route   GET /api/files/shared/:shareToken/download
// @desc    Download shared file (public access)
// @access  Public
router.get('/shared/:shareToken/download', [
  check('shareToken', 'Share token is required').notEmpty()
], fileController.downloadSharedFile);


// @route   GET /api/files/:fileId/download
// @desc    Download file
// @access  Private
router.get('/:fileId/download', [
  auth,
  ...validateFileId // Assuming you have this from your file
], fileController.downloadFile);

// --- ADD THIS NEW ROUTE ---
// @route   GET /api/files/:fileId/view
// @desc    View file inline
// @access  Private
router.get('/:fileId/view', [
  auth,
  // You can re-use the same validation as download
  check('fileId', 'Invalid file ID').isMongoId() 
], fileController.viewFile);

module.exports = router;