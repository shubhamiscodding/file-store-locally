const Folder = require('../models/Folder');
const File = require('../models/File');
const { validationResult } = require('express-validator');

// Create folder
exports.createFolder = async (req, res) => {
  console.log('Request Body:', req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, parentId } = req.body;
    const userId = req.user.id;

    // Check if parent folder exists and belongs to user
    if (parentId) {
      const parentFolder = await Folder.findOne({ _id: parentId, userId, isTrashed: false });
      if (!parentFolder) {
        return res.status(404).json({ message: 'Parent folder not found' });
      }
    }

    // Check if folder with same name exists in the same location
    const existingFolder = await Folder.findOne({
      name,
      parentId: parentId || null,
      userId,
      isTrashed: false
    });

    if (existingFolder) {
      return res.status(400).json({ message: 'Folder with this name already exists in this location' });
    }

    const folder = new Folder({
      name,
      userId,
      parentId: parentId || null
    });

    await folder.save();
    res.status(201).json({ message: 'Folder created successfully', folder });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user folders
exports.getFolders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { parentId } = req.query;

    const query = { userId, isTrashed: false };

    if (parentId) {
      query.parentId = parentId;
    } else if (parentId === '') {
      query.parentId = null;
    }

    const folders = await Folder.find(query).sort({ createdAt: -1 });
    res.json({ folders });
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get folder details
exports.getFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user.id;

    const folder = await Folder.findOne({ _id: folderId, userId });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    res.json({ folder });
  } catch (error) {
    console.error('Get folder error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update folder
exports.updateFolder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { folderId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    const folder = await Folder.findOne({ _id: folderId, userId, isTrashed: false });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Check if name already exists in the same location
    if (name && name !== folder.name) {
      const existingFolder = await Folder.findOne({
        name,
        parentId: folder.parentId,
        userId,
        isTrashed: false,
        _id: { $ne: folderId }
      });

      if (existingFolder) {
        return res.status(400).json({ message: 'Folder with this name already exists in this location' });
      }

      folder.name = name;
    }

    folder.updatedAt = new Date();
    await folder.save();

    res.json({ message: 'Folder updated successfully', folder });
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete folder
exports.deleteFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user.id;

    const folder = await Folder.findOne({ _id: folderId, userId, isTrashed: false });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Check if folder has subfolders or files
    const subfolders = await Folder.find({ parentId: folderId, userId, isTrashed: false });
    const files = await File.find({ folderId, userId, isTrashed: false });

    if (subfolders.length > 0 || files.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete folder with subfolders or files. Please empty the folder first.'
      });
    }

    await Folder.findByIdAndDelete(folderId);
    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
