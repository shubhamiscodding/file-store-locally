// server.js (Updated)

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const passport = require('passport');
require('dotenv').config();

// Custom modules
const connectDB = require('./config/database');

const { handleUploadErrors } = require('./middleware/upload');
require('./config/passport');
const errorHandler = require('./middleware/errorHandler');

// Initialize Express App
const app = express();

// --- Connect to Database ---
// This single function call now handles the entire MongoDB connection process.
connectDB();

// --- Core Middleware ---
app.use(helmet());
app.use(compression());

// Secure CORS Configuration
const corsOptions = {
  origin: process.env.CLIENT_URL, // e.g., 'http://localhost:3000'
  optionsSuccessStatus: 200 
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Use only this line
app.use(express.urlencoded({ extended: true }));

// Passport middleware
app.use(passport.initialize());

// --- API Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/files', require('./routes/files'));
app.use('/api/folders', require('./routes/folders'));
app.use('/api/share', require('./routes/share'));
app.use('/api/trash', require('./routes/trash'));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// --- Error Handling Middleware ---
// This section must come AFTER your routes.

// Use the dedicated Multer error handler first.
app.use(handleUploadErrors);

// Use your generic application error handler.
app.use(errorHandler);

// 404 handler for routes not found.
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});

module.exports = app;