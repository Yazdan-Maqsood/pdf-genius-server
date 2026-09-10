class ResponseHelper {
  static success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  static created(res, data = null, message = 'Resource created successfully') {
    return this.success(res, data, message, 201);
  }

  static error(res, error = 'Something went wrong', statusCode = 500) {
    return res.status(statusCode).json({
      success: false,
      error,
      timestamp: new Date().toISOString()
    });
  }

  static badRequest(res, error = 'Bad request') {
    return this.error(res, error, 400);
  }

  static unauthorized(res, error = 'Unauthorized') {
    return this.error(res, error, 401);
  }

  static forbidden(res, error = 'Forbidden') {
    return this.error(res, error, 403);
  }

  static notFound(res, error = 'Resource not found') {
    return this.error(res, error, 404);
  }

  static file(res, buffer, filename, contentType = 'application/pdf') {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  }

  static stream(res, stream, filename, contentType = 'application/pdf') {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  }
}

module.exports = ResponseHelper;