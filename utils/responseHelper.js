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

  /**
   * Sanitize filename for safe download
   * - Removes path separators
   * - Removes control characters
   * - Removes trailing underscores/spaces/dots
   * - Prevents header injection
   */
  static sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'download';
    }

    let sanitized = filename;

    // Remove path separators (security - prevent directory traversal)
    sanitized = sanitized.replace(/[\/\\]/g, '_');

    // Remove control characters and null bytes
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // Remove any newlines/carriage returns (header injection prevention)
    sanitized = sanitized.replace(/[\r\n]/g, '');

    // Remove quotes (prevent breaking Content-Disposition header)
    sanitized = sanitized.replace(/["']/g, '');

    // Replace multiple underscores/spaces with single
    sanitized = sanitized.replace(/[_\s]+/g, '_');

    // ✅ Remove trailing underscores, spaces, and dots (THE MAIN FIX)
    sanitized = sanitized.replace(/[_\s.]+$/g, '');

    // Remove leading dots/spaces/underscores
    sanitized = sanitized.replace(/^[\s._]+/g, '');

    // If empty after sanitization, return default
    return sanitized || 'download';
  }

  /**
   * Send file with proper Content-Disposition headers
   * Supports UTF-8 filenames (RFC 5987)
   */
  static file(res, buffer, filename, contentType = 'application/pdf') {
    // Sanitize the filename
    const sanitizedFilename = this.sanitizeFilename(filename);

    // Ensure we have an extension
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(sanitizedFilename);
    const finalFilename = hasExtension ? sanitizedFilename : `${sanitizedFilename}.bin`;

    // ✅ ASCII-safe fallback (for old browsers)
    const asciiFilename = finalFilename
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/[_\s]+/g, '_');

    // ✅ UTF-8 encoded version (RFC 5987) for modern browsers
    const encodedFilename = encodeURIComponent(finalFilename);

    console.log(`📎 Sending file: ${finalFilename} (${contentType})`);

    // Set Content-Type
    res.setHeader('Content-Type', contentType);

    // ✅ Proper Content-Disposition with both ASCII and UTF-8 filenames
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`
    );

    // Set Content-Length
    res.setHeader('Content-Length', buffer.length);

    // ✅ Prevent caching issues (browser will re-download fresh)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // ✅ CORS: Expose headers so frontend can read the filename
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Disposition, Content-Length, Content-Type'
    );

    return res.send(buffer);
  }

  /**
   * Stream file with proper headers
   */
  static stream(res, stream, filename, contentType = 'application/pdf') {
    const sanitizedFilename = this.sanitizeFilename(filename);
    const asciiFilename = sanitizedFilename.replace(/[^\x20-\x7E]/g, '_');
    const encodedFilename = encodeURIComponent(sanitizedFilename);

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Disposition, Content-Length, Content-Type'
    );

    stream.pipe(res);
  }
}

module.exports = ResponseHelper;