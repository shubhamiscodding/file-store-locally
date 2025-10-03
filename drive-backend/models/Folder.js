const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  path: {
    type: String,
    default: ''
  },
  isTrashed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
folderSchema.index({ userId: 1, isTrashed: 1, createdAt: -1 });
folderSchema.index({ name: 1, parentId: 1, userId: 1 }, {
  unique: true,
  partialFilterExpression: { isTrashed: false }
});

// Virtual for full path
folderSchema.virtual('fullPath').get(function() {
  return this.path ? `${this.path}/${this.name}` : this.name;
});

// Pre-save middleware to update path
folderSchema.pre('save', async function(next) {
  if (this.parentId) {
    const parent = await this.constructor.findById(this.parentId);
    this.path = parent ? parent.fullPath : '';
  } else {
    this.path = '';
  }
  next();
});

folderSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Folder', folderSchema);
