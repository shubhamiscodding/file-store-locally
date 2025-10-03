const mongoose = require('mongoose');
const path = require('path');

const fileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  filePath: {
    type: String,
    required: true
  },
  isTrashed: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  shareToken: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

fileSchema.index({ name: 1, folderId: 1, userId: 1 }, {
  unique: true,
  partialFilterExpression: { isTrashed: false }
});

fileSchema.index({ userId: 1, isTrashed: 1, createdAt: -1 });

// Virtual for file extension
fileSchema.virtual('extension').get(function() {
  // --- THIS IS THE FIX ---
  // Add a check to ensure this.originalName exists before using it.
  if (!this.originalName) {
    return '';
  }
  return path.extname(this.originalName);
});

// Virtual for file type category
fileSchema.virtual('fileType').get(function() {
  const ext = this.extension.toLowerCase();
  const imageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const docTypes = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];
  const sheetTypes = ['.xls', '.xlsx', '.csv'];

  if (imageTypes.includes(ext)) return 'image';
  if (docTypes.includes(ext)) return 'document';
  if (sheetTypes.includes(ext)) return 'spreadsheet';
  if (ext === '.zip' || ext === '.rar') return 'archive';
  return 'other';
});

fileSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('File', fileSchema);
