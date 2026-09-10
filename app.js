const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');
const config = require('./config');

// Import routes
const routes = require('./routes');

const app = express();

// Trust proxy (needed for Render/Heroku behind reverse proxy)
app.set('trust proxy', 1);

// ============================================
// Security Middleware
// ============================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false  // Disable CSP for API
}));

// ============================================
// CORS Configuration - Support Multiple Origins
// ============================================
// Parse CORS origins (comma-separated values)
const allowedOrigins = config.corsOrigin
  ? config.corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean)
  : ['http://localhost:3000'];

console.log('🔒 Allowed CORS origins:', allowedOrigins);

// CORS options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // Allow all Vercel preview deployments (*.vercel.app)
    if (origin.endsWith('.vercel.app')) {
      console.log('✅ Allowing Vercel preview:', origin);
      return callback(null, true);
    }
    
    // Allow localhost on any port (development)
    if (config.nodeEnv === 'development' && 
        (origin.startsWith('http://localhost:') || 
         origin.startsWith('http://127.0.0.1:'))) {
      return callback(null, true);
    }
    
    // Block unknown origins
    console.log('❌ Blocked by CORS:', origin);
    console.log('   Allowed origins:', allowedOrigins);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: [
    'Content-Disposition',
    'Content-Length',
    'X-Original-Size',
    'X-Compressed-Size',
    'X-Compression-Ratio'
  ],
  maxAge: 86400,  // Cache preflight for 24 hours
  optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly for all routes
app.options('*', cors(corsOptions));

// ============================================
// Rate Limiting
// ============================================
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  // Skip rate limiting for OPTIONS requests (preflight)
  skip: (req) => req.method === 'OPTIONS'
});
app.use('/api', limiter);

// ============================================
// Body Parsing
// ============================================
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// Logging
// ============================================
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// ============================================
// Static Files (for downloads)
// ============================================
app.use('/downloads', express.static('uploads/processed'));

// ============================================
// Root Route
// ============================================
app.get('/', (req, res) => {
  res.json({
    name: 'PDFGenius API',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// Health Check
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    corsOrigins: allowedOrigins
  });
});

// ============================================
// API Routes
// ============================================
app.use('/api', routes);

// ============================================
// 404 Handler
// ============================================
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// ============================================
// Error Handler (must be last)
// ============================================
app.use(errorHandler);

module.exports = app;