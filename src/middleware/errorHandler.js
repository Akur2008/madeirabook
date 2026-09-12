const logger = require('../logger');

module.exports = function errorHandler(err, req, res, next) {
  logger.error({ err: err.message, stack: err.stack, path: req.path }, 'request failed');

  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
