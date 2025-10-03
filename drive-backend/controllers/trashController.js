const File = require('../models/File');
const Folder = require('../models/Folder');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const fs = require('fs');

// Move file/folder to trash
exports.moveToTrash = async (req, res) => {
  try {
    const { type, id } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const userId = req.user.id;

    if (!['file', 'folder'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type. Must be "file" or "folder"' });
    }

    let item;
    if (type === 'file') {
      item = await File.findOne({ _id: id, userId, isTrashed: false });
    } else {
      item = await Folder.findOne({ _id: id, userId, isTrashed: false });
    }

    if (!item) {
      return res.status(404).json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} not found` });
    }

    item.isTrashed = true;
    item.trashedAt = new Date();
    await item.save();

    // If it's a folder, also trash all files and subfolders
    if (type === 'folder') {
      await File.updateMany(
        { folderId: id, userId, isTrashed: false },
        { isTrashed: true, trashedAt: new Date() }
      );
      
      await Folder.updateMany(
        { parentId: id, userId, isTrashed: false },
        { isTrashed: true, trashedAt: new Date() }
      );
    }

    res.json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} moved to trash successfully` });
  } catch (error) {
    console.error('Move to trash error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Restore from trash
exports.restoreFromTrash = async (req, res) => {
  try {
    const { type, id } = req.body;
    const userId = req.user.id;

    if (!['file', 'folder'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type. Must be "file" or "folder"' });
    }

    let item;
    if (type === 'file') {
      item = await File.findOne({ _id: id, userId, isTrashed: true });
    } else {
      item = await Folder.findOne({ _id: id, userId, isTrashed: true });
    }

    if (!item) {
      return res.status(404).json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} not found in trash` });
    }

    // Check if parent folder exists and is not trashed
    if (item.folderId || item.parentId) {
      const parentId = item.folderId || item.parentId;
      const parent = await Folder.findOne({ _id: parentId, userId, isTrashed: false });
      
      if (!parent) {
        return res.status(400).json({ 
          message: 'Cannot restore. Parent folder does not exist or is in trash' 
        });
      }
    }

    item.isTrashed = false;
    item.trashedAt = null;
    await item.save();

    // If it's a folder, also restore all files and subfolders
    if (type === 'folder') {
      await File.updateMany(
        { folderId: id, userId, isTrashed: true },
        { isTrashed: false, trashedAt: null }
      );
      
      await Folder.updateMany(
        { parentId: id, userId, isTrashed: true },
        { isTrashed: false, trashedAt: null }
      );
    }

    res.json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} restored successfully` });
  } catch (error) {
    console.error('Restore from trash error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Permanent delete
exports.permanentDelete = async (req, res) => {
  try {
    const { type, id } = req.body;
    const userId = req.user.id;

    if (!['file', 'folder'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type. Must be "file" or "folder"' });
    }

    let item;
    if (type === 'file') {
      item = await File.findOne({ _id: id, userId, isTrashed: true });
    } else {
      item = await Folder.findOne({ _id: id, userId, isTrashed: true });
    }

    if (!item) {
      return res.status(404).json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} not found in trash` });
    }

    // If it's a folder, delete all files and subfolders first
    if (type === 'folder') {
      await File.deleteMany({ folderId: id, userId, isTrashed: true });
      await Folder.deleteMany({ parentId: id, userId, isTrashed: true });
    }

    // Delete the item itself
    if (type === 'file') {
      // Delete physical file from disk
      if (fs.existsSync(item.filePath)) {
        try {
          fs.unlinkSync(item.filePath);
        } catch (error) {
          console.error('Error deleting physical file:', error);
        }
      }
      
      // Update user storage usage
      const user = await User.findById(userId);
      if (user) {
        user.storageUsed = Math.max(0, user.storageUsed - item.size);
        await user.save();
      }
      
      await File.findByIdAndDelete(id);
    } else {
      await Folder.findByIdAndDelete(id);
    }

    res.json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} permanently deleted` });
  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Empty trash
exports.emptyTrash = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all trashed items
    const trashedFiles = await File.find({ userId, isTrashed: true });
    const trashedFolders = await Folder.find({ userId, isTrashed: true });

    // Delete files from disk and database
    let totalSizeDeleted = 0;
    for (const file of trashedFiles) {
      // Delete physical file from disk
      if (fs.existsSync(file.filePath)) {
        try {
          fs.unlinkSync(file.filePath);
          totalSizeDeleted += file.size;
        } catch (error) {
          console.error('Error deleting physical file:', error);
        }
      }
      await File.findByIdAndDelete(file._id);
    }
    
    // Update user storage usage
    if (totalSizeDeleted > 0) {
      const user = await User.findById(userId);
      if (user) {
        user.storageUsed = Math.max(0, user.storageUsed - totalSizeDeleted);
        await user.save();
      }
    }

    // Delete folders (subfolders and files already handled by cascade)
    await Folder.deleteMany({ userId, isTrashed: true });

    res.json({ 
      message: 'Trash emptied successfully',
      deleted: {
        files: trashedFiles.length,
        folders: trashedFolders.length
      }
    });
  } catch (error) {
    console.error('Empty trash error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get trash items
exports.getTrashItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const [files, folders] = await Promise.all([
      File.find({ userId, isTrashed: true })
        .sort({ trashedAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit),
      
      Folder.find({ userId, isTrashed: true })
        .sort({ trashedAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
    ]);

    const totalFiles = await File.countDocuments({ userId, isTrashed: true });
    const totalFolders = await Folder.countDocuments({ userId, isTrashed: true });
    const total = totalFiles + totalFolders;

    res.json({
      files,
      folders,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get trash items error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};