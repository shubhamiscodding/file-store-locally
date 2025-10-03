const multer = require('multer'); // Middleware for handling multipart/form-data          
const path = require('path');
const fs = require('fs');
const util = require('util');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage with better organization
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create user-specific directory if userId is available
    if (req.user && req.user.id) {
      const userDir = path.join(uploadDir, req.user.id);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      cb(null, userDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    // Generate secure filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = path.parse(file.originalname).name;
    const safeName = originalName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const extension = path.extname(file.originalname);
    cb(null, `${safeName}-${uniqueSuffix}${extension}`);
  }
});

// Enhanced file filter with more specific MIME types
const fileFilter = (req, file, cb) => {
  const allowedMimes = {
    // Images
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true,
    'image/svg+xml': true,
    'image/bmp': true,
    
    // Documents
    'application/pdf': true,
    'text/plain': true,
    'text/csv': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
    'application/vnd.ms-excel': true,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
    'application/vnd.ms-powerpoint': true,
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': true,
    
    // Archives
    'application/zip': true,
    'application/x-rar-compressed': true,
    'application/x-tar': true,
    'application/gzip': true,
    
    // Audio
    'audio/mpeg': true,
    'audio/wav': true,
    'audio/ogg': true,
    'audio/mp4': true,
    'audio/x-m4a': true,
    
    // Video
    'video/mp4': true,
    'video/mpeg': true,
    'video/ogg': true,
    'video/webm': true,
    'video/quicktime': true,
    'video/x-msvideo': true
  };

  if (allowedMimes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' is not supported. Please upload a valid file type.`), false);
  }
};

// Configure multer with enhanced options
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (increased from 10MB)
    files: 1, // Limit to single file
    fields: 10 // Maximum number of non-file fields
  },
  fileFilter: fileFilter,
  preservePath: false // Don't include full path in filename
});

// Enhanced error handling middleware
const handleUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({ 
          success: false,
          message: 'File too large. Maximum file size is 25MB.',
          error: 'FILE_TOO_LARGE'
        });
      
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ 
          success: false,
          message: 'Too many files. Only one file allowed per request.',
          error: 'TOO_MANY_FILES'
        });
      
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ 
          success: false,
          message: 'Unexpected file field. Please use "file" as the field name.',
          error: 'UNEXPECTED_FIELD'
        });
      
      case 'LIMIT_FIELD_KEY':
        return res.status(400).json({ 
          success: false,
          message: 'Field name too long.',
          error: 'FIELD_NAME_TOO_LONG'
        });
      
      default:
        return res.status(400).json({ 
          success: false,
          message: 'Upload error occurred.',
          error: 'UPLOAD_ERROR',
          details: error.message
        });
    }
  }
  
  if (error.message.includes('File type')) {
    return res.status(415).json({ 
      success: false,
      message: error.message,
      error: 'UNSUPPORTED_FILE_TYPE'
    });
  }

  // Handle filesystem errors
  if (error.code === 'ENOENT' || error.code === 'EACCES') {
    return res.status(500).json({ 
      success: false,
      message: 'Server storage error. Please try again.',
      error: 'STORAGE_ERROR'
    });
  }

  next(error);
};

// Utility function to clean up uploaded files on error
const cleanupUploadedFile = async (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      await util.promisify(fs.unlink)(filePath);
    }
  } catch (cleanupError) {
    console.error('Error cleaning up uploaded file:', cleanupError);
  }
};

// Middleware to validate file presence
const validateFilePresence = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false,
      message: 'No file uploaded. Please select a file to upload.',
      error: 'NO_FILE_UPLOADED'
    });
  }
  next();
};

module.exports = {
  upload,
  handleUploadErrors,
  cleanupUploadedFile,
  validateFilePresence,
  uploadDir
};
