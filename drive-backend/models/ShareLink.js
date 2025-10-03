// models/ShareLink.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const shareLinkSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  file: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date
  },
  password: {
    type: String
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  maxDownloads: {
    type: Number
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

shareLinkSchema.pre('save', async function(next) {
  if (!this.token) {
    this.token = crypto.randomBytes(32).toString('hex');
  }
  
  if (this.password && this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  
  next();
});

shareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
shareLinkSchema.index({ token: 1 });
shareLinkSchema.index({ owner: 1, createdAt: -1 });

shareLinkSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return true;
  return await bcrypt.compare(candidatePassword, this.password);
};

shareLinkSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

shareLinkSchema.methods.isDownloadLimitReached = function() {
  if (!this.maxDownloads) return false;
  return this.downloadCount >= this.maxDownloads;
};

module.exports = mongoose.model('ShareLink', shareLinkSchema);