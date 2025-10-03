const mongoose = require('mongoose');
const File = require('../models/File');
const Folder = require('../models/Folder');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Upload file
exports.uploadFile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { name, folderId, description } = req.body;
    const userId = req.user.id;

    // Check if folder exists and belongs to user
    if (folderId) {
      const folder = await Folder.findOne({ _id: folderId, userId });
      if (!folder) {
        return res.status(404).json({ message: 'Folder not found' });
      }
    }

    // Check if file with same name exists in the same location
    const existingFile = await File.findOne({
      name: name || req.file.originalname,
      folderId: folderId || null,
      userId,
      isTrashed: false
    });

    if (existingFile) {
      return res.status(400).json({ message: 'File with this name already exists in this location' });
    }

    // Update user storage usage
    const user = await User.findById(userId);
    if (user.storageUsed + req.file.size > user.storageLimit) {
      // Clean up uploaded file if storage limit exceeded
      fs.unlinkSync(req.file.path);
      return res.status(413).json({ 
        message: 'Storage limit exceeded',
        storageInfo: user.getStorageInfo()
      });
    }

    const file = new File({
      name: name || req.file.originalname,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      folderId: folderId || null,
      userId,
      description: description || '',
      filePath: req.file.path
    });

    await file.save();

    // Update user storage usage
    user.storageUsed += req.file.size;
    await user.save();

    res.status(201).json({ 
      message: 'File uploaded successfully', 
      file,
      storageInfo: user.getStorageInfo()
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Download file
exports.downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const file = await File.findOne({ _id: fileId, userId, isTrashed: false });
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.filePath)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    // Set headers for download
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Length', file.size);

    // Stream file from disk
    const fileStream = fs.createReadStream(file.filePath);
    
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      res.status(500).json({ message: 'Error reading file' });
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get file metadata
exports.getFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const file = await File.findOne({ _id: fileId, userId });
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.json({ file });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Rename file
exports.renameFile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fileId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    const file = await File.findOne({ _id: fileId, userId, isTrashed: false });
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check if name already exists in the same location
    const existingFile = await File.findOne({
      name,
      folderId: file.folderId,
      userId,
      isTrashed: false,
      _id: { $ne: fileId }
    });

    if (existingFile) {
      return res.status(400).json({ message: 'File with this name already exists in this location' });
    }

    file.name = name;
    file.updatedAt = new Date();
    await file.save();

    res.json({ message: 'File renamed successfully', file });
  } catch (error) {
    console.error('Rename file error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Move file to different folder
exports.moveFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { folderId } = req.body;
    const userId = req.user.id;

    const file = await File.findOne({ _id: fileId, userId, isTrashed: false });
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // If moving to a folder, verify it exists
    if (folderId) {
      const targetFolder = await Folder.findOne({ _id: folderId, userId });
      if (!targetFolder) {
        return res.status(404).json({ message: 'Target folder not found' });
      }
    }

    // Check if file with same name exists in target location
    const existingFile = await File.findOne({
      name: file.name,
      folderId: folderId || null,
      userId,
      isTrashed: false,
      _id: { $ne: fileId }
    });

    if (existingFile) {
      return res.status(400).json({ message: 'File with this name already exists in the target location' });
    }

    file.folderId = folderId || null;
    file.updatedAt = new Date();
    await file.save();

    res.json({ message: 'File moved successfully', file });
  } catch (error) {
    console.error('Move file error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Remove file from folder (move to root)
exports.removeFromFolder = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const file = await File.findOne({ _id: fileId, userId, isTrashed: false });
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (!file.folderId) {
      return res.status(400).json({ message: 'File is already in root directory' });
    }

    // Check if file with same name exists in root
    const existingFile = await File.findOne({
      name: file.name,
      folderId: null,
      userId,
      isTrashed: false,
      _id: { $ne: fileId }
    });

    if (existingFile) {
      return res.status(400).json({ message: 'File with this name already exists in root directory' });
    }

    file.folderId = null;
    file.updatedAt = new Date();
    await file.save();

    res.json({ message: 'File removed from folder successfully', file });
  } catch (error) {
    console.error('Remove from folder error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user files with pagination and filtering
exports.getFiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const { folderId, page = 1, limit = 20, search } = req.query;

    const query = { userId, isTrashed: false };

    if (folderId) {
      query.folderId = folderId;
    } else if (folderId === '') {
      query.folderId = null;
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const files = await File.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await File.countDocuments(query);

    res.json({
      files,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete file permanently
exports.deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const file = await File.findOne({ _id: fileId, userId, isTrashed: false });
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Delete physical file from disk
    if (fs.existsSync(file.filePath)) {
      try {
        fs.unlinkSync(file.filePath);
      } catch (error) {
        console.error('Error deleting physical file:', error);
      }
    }

    // Update user storage usage
    const user = await User.findById(userId);
    if (user) {
      user.storageUsed = Math.max(0, user.storageUsed - file.size);
      await user.save();
    }

    // Delete from database
    await File.findByIdAndDelete(fileId);

    res.json({ 
      message: 'File deleted successfully',
      storageInfo: user ? user.getStorageInfo() : null
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Toggle file sharing
exports.toggleFileSharing = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { isPublic } = req.body;
    const userId = req.user.id;

    const file = await File.findOne({ _id: fileId, userId, isTrashed: false });
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    file.isPublic = isPublic;
    if (isPublic) {
      file.shareToken = crypto.randomBytes(32).toString('hex');
    } else {
      file.shareToken = null;
    }
    file.updatedAt = new Date();
    await file.save();

    res.json({ message: 'File sharing updated successfully', file });
  } catch (error) {
    console.error('Toggle file sharing error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get shared file
exports.getSharedFile = async (req, res) => {
  try {
    const { shareToken } = req.params;

    const file = await File.findOne({ shareToken, isPublic: true, isTrashed: false });
    if (!file) {
      return res.status(404).json({ message: 'Shared file not found' });
    }

    res.json({ file });
  } catch (error) {
    console.error('Get shared file error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Download shared file
exports.downloadSharedFile = async (req, res) => {
  try {
    const { shareToken } = req.params;

    const file = await File.findOne({ shareToken, isPublic: true, isTrashed: false });
    if (!file) {
      return res.status(404).json({ message: 'Shared file not found' });
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.filePath)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    // Set headers for download
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Length', file.size);

    // Stream file from disk
    const fileStream = fs.createReadStream(file.filePath);
    
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      res.status(500).json({ message: 'Error reading file' });
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error('Download shared file error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// View file (for supported types like images, PDFs)
exports.viewFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const file = await File.findOne({ _id: fileId, userId });
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (!fs.existsSync(file.filePath)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    res.setHeader('Content-Type', file.mimetype);
    // This is the key difference: 'inline' tells the browser to display it
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    res.setHeader('Content-Length', file.size);

    const fileStream = fs.createReadStream(file.filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('View file error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
