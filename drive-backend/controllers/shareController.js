const crypto = require('crypto');
const File = require('../models/File');
const fs = require('fs');
const path = require('path');
const ShareLink = require('../models/ShareLink');
const { validationResult } = require('express-validator');

// Generate share link
exports.generateShareLink = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation Errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { fileId, expiresIn, password } = req.body;
    const userId = req.user.id;

    const file = await File.findOne({ _id: fileId, userId, isTrashed: false });
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // --- THIS IS THE FIX ---
    // Generate the token here, before creating the ShareLink object.
    const token = crypto.randomBytes(32).toString('hex');

    const share = new ShareLink({
      token, // Add the generated token here
      file: fileId,
      owner: userId,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null,
      password: password || null,
    });

    await share.save();

    res.status(201).json({
      message: 'Share link generated successfully',
      token: share.token,
    });
  } catch (error) {
    console.error('Generate share link error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// It provides file metadata to the frontend share page.
exports.getShareInfo = async (req, res) => {
  try {
    const { token } = req.params;
    const share = await ShareLink.findOne({ token, isActive: true }).populate('file', 'name size mimetype');

    if (!share || (share.expiresAt && new Date() > share.expiresAt)) {
      if (share) {
        share.isActive = false;
        await share.save();
      }
      return res.status(404).json({ message: 'Share link not found or has expired' });
    }

    if (!share.file) {
      return res.status(404).json({ message: 'The linked file has been deleted.' });
    }

    res.json({
      file: {
        name: share.file.name,
        size: share.file.size,
        mimetype: share.file.mimetype,
      },
      requiresPassword: !!share.password,
    });
  } catch (error) {
    console.error('Get share info error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// It now correctly redirects the user to your frontend application.
exports.accessSharedFile = async (req, res) => {
  try {
    const { token } = req.params;
    if (!process.env.CLIENT_URL) {
      console.error('FATAL: CLIENT_URL is not defined in the .env file.');
      return res.status(500).send('Server configuration error.');
    }
    return res.redirect(`${process.env.CLIENT_URL}/share/${token}`);
  } catch (error) {
    console.error('Share link redirect error:', error);
    return res.status(500).send('Error redirecting to the share page.');
  }
};

// Download shared file
exports.downloadSharedFile = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const share = await ShareLink.findOne({ token, isActive: true }).populate('file');

    if (!share || (share.expiresAt && new Date() > share.expiresAt)) {
      if (share) {
        share.isActive = false;
        await share.save();
      }
      return res.status(404).json({ message: 'Share link not found or expired' });
    }

    if (!share.file) {
      return res.status(404).json({ message: 'The original file for this link has been deleted.' });
    }

    const passwordMatch = await share.comparePassword(password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const absoluteFilePath = path.resolve(share.file.filePath);
    if (!fs.existsSync(absoluteFilePath)) {
      return res.status(404).json({ message: 'File not found on the server.' });
    }

    res.setHeader('Content-Type', share.file.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${share.file.originalName}"`);
    res.setHeader('Content-Length', share.file.size);

    share.downloadCount = (share.downloadCount || 0) + 1;
    share.lastAccessedAt = new Date();
    await share.save();

    const fileStream = fs.createReadStream(absoluteFilePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download shared file error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
};

// Get user's share links
exports.getShareLinks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const sharesWithPotentialNulls = await ShareLink.find({ owner: userId })
      .populate('file', 'name size mimetype originalName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const shares = sharesWithPotentialNulls.filter(share => share.file !== null);
    const total = await ShareLink.countDocuments({ owner: userId });

    res.json({
      shares,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get share links error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Revoke share link
exports.revokeShareLink = async (req, res) => {
  try {
    const { shareId } = req.params;
    const userId = req.user.id;

    const share = await ShareLink.findOneAndDelete({ _id: shareId, owner: userId });
    if (!share) {
      return res.status(404).json({ message: 'Share link not found' });
    }

    res.json({ message: 'Share link revoked successfully' });
  } catch (error) {
    console.error('Revoke share link error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

