const { AppError } = require('./errorHandler');

/**
 * Authorization middleware - checks if user has required role
 * @param {...string} roles - Allowed roles
 * @returns {Function} Express middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      // 🛠️ ADD THIS DEBUG LOG:

      if (!roles.includes(req.user.role)) {
        throw new AppError('You do not have permission to perform this action', 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};


/**
 * Authorization middleware - checks if user owns the resource
 * @param {Function} getResourceId - Function to extract resource ID from request
 * @param {string} modelName - Name of the model to check
 * @returns {Function} Express middleware
 */
const authorizeOwner = (getResourceId, modelName) => {
  return async (req, res, next) => {
    try {
      // Check if user exists
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const resourceId = getResourceId(req);
      
      // Dynamically get the model
      const Model = require(`../models/${modelName}`);
      const resource = await Model.findById(resourceId);

      if (!resource) {
        throw new AppError(`${modelName} not found`, 404);
      }

      // Check if user owns the resource or is admin
      const isOwner = resource.user?.toString() === req.user.id || 
                      resource.createdBy?.toString() === req.user.id;
      
      const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

      if (!isOwner && !isAdmin) {
        throw new AppError('You do not have permission to modify this resource', 403);
      }

      // Attach resource to request for later use
      req.resource = resource;
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Authorization middleware - checks if user has required permissions
 * @param {...string} permissions - Required permissions
 * @returns {Function} Express middleware
 */
const authorizePermission = (...permissions) => {
  return (req, res, next) => {
    try {
      // Check if user exists
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      // Admins have all permissions
      if (req.user.role === 'admin' || req.user.role === 'super_admin') {
        return next();
      }

      // Check if user has all required permissions
      const userPermissions = req.user.permissions || [];
      const hasAllPermissions = permissions.every(p => userPermissions.includes(p));

      if (!hasAllPermissions) {
        throw new AppError('Insufficient permissions', 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Authorization middleware - checks if user is the resource owner or has required role
 * @param {Function} getResourceId - Function to extract resource ID from request
 * @param {string} modelName - Name of the model to check
 * @param {...string} roles - Allowed roles (in addition to owner)
 * @returns {Function} Express middleware
 */
const authorizeOwnerOrRole = (getResourceId, modelName, ...roles) => {
  return async (req, res, next) => {
    try {
      // Check if user exists
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      // Check if user has allowed role
      if (roles.includes(req.user.role)) {
        return next();
      }

      const resourceId = getResourceId(req);
      
      // Dynamically get the model
      const Model = require(`../models/${modelName}`);
      const resource = await Model.findById(resourceId);

      if (!resource) {
        throw new AppError(`${modelName} not found`, 404);
      }

      // Check if user owns the resource
      const isOwner = resource.user?.toString() === req.user.id || 
                      resource.createdBy?.toString() === req.user.id;

      if (!isOwner) {
        throw new AppError('You do not have permission to access this resource', 403);
      }

      // Attach resource to request for later use
      req.resource = resource;
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Rate limit based on user role
 * @param {Object} limits - Rate limits for different roles
 * @returns {Function} Express middleware
 */
const roleBasedRateLimit = (limits) => {
  return (req, res, next) => {
    const role = req.user?.role || 'anonymous';
    const limit = limits[role] || limits.default || 100;

    // This would integrate with your rate limiting middleware
    req.rateLimit = { limit };
    next();
  };
};

module.exports = {
  authorize,
  authorizeOwner,
  authorizePermission,
  authorizeOwnerOrRole,
  roleBasedRateLimit,
};