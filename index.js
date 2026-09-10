const app = require('./app');
const http = require('http');
const { logger } = require('./utils/logger');
const config = require('./config');
const CleanupHelper = require('./utils/cleanupHelper');

const server = http.createServer(app);
const PORT = config.port || 5000;

// Start server
server.listen(PORT, () => {
  logger.info('=================================');
  logger.info(`✅ PDFGenius Server Started`);
  logger.info(`📍 Environment: ${config.nodeEnv}`);
  logger.info(`🔗 Port: ${PORT}`);
  logger.info(`📡 API URL: http://localhost:${PORT}/api`);
  logger.info(`💚 Health Check: http://localhost:${PORT}/health`);
  logger.info('=================================');
  
  // Start cleanup schedule
  CleanupHelper.startCleanupSchedule();
});

// Handle server errors
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  switch (error.code) {
    case 'EACCES':
      logger.error(`Port ${PORT} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`Port ${PORT} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in development
  if (config.nodeEnv === 'production') {
    server.close(() => process.exit(1));
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  if (config.nodeEnv === 'production') {
    server.close(() => process.exit(1));
  }
});

// Handle SIGTERM (e.g., from Docker/Kubernetes)
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received. Closing HTTP server...');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  logger.info('SIGINT signal received. Closing HTTP server...');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

module.exports = server;