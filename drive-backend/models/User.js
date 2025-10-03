// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    minlength: 6
  },
  googleId: {
    type: String,
    sparse: true
  },
  avatar: {
    type: String
  },
  storageUsed: {
    type: Number,
    default: 0
  },
  storageLimit: {
    type: Number,
    default: 10737418240 // 10GB in bytes
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getStorageInfo = function() {
  const usedGB = (this.storageUsed / 1024 / 1024 / 1024).toFixed(2);
  const limitGB = (this.storageLimit / 1024 / 1024 / 1024).toFixed(2);
  const percentage = ((this.storageUsed / this.storageLimit) * 100).toFixed(1);
  
  return {
    used: this.storageUsed,
    limit: this.storageLimit,
    usedGB,
    limitGB,
    percentage: Math.min(percentage, 100)
  };
};

module.exports = mongoose.model('User', userSchema);