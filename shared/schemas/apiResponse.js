class ApiResponse {
  static success(data = null, message = 'Success', statusCode = 200) {
    return {
      status: 'success',
      statusCode,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  static error(message = 'Internal Server Error', statusCode = 500, errors = null) {
    return {
      status: 'error',
      statusCode,
      message,
      errors,
      timestamp: new Date().toISOString()
    };
  }

  static validation(errors, message = 'Validation Error') {
    return {
      status: 'fail',
      statusCode: 400,
      message,
      errors,
      timestamp: new Date().toISOString()
    };
  }

  static notFound(resource = 'Resource') {
    return {
      status: 'fail',
      statusCode: 404,
      message: `${resource} not found`,
      timestamp: new Date().toISOString()
    };
  }

  static unauthorized(message = 'Unauthorized access') {
    return {
      status: 'fail',
      statusCode: 401,
      message,
      timestamp: new Date().toISOString()
    };
  }

  static forbidden(message = 'Access forbidden') {
    return {
      status: 'fail',
      statusCode: 403,
      message,
      timestamp: new Date().toISOString()
    };
  }

  static paginated(data, pagination, message = 'Success') {
    return {
      status: 'success',
      statusCode: 200,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: Math.ceil(pagination.total / pagination.limit)
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ApiResponse;