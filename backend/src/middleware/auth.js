const jwt = require('jsonwebtoken');
const { AuthenticationError, AuthorizationError } = require('./errorHandler');
const { logger } = require('../config/logger');
const User = require('../models/User');
const redis = require('../config/redis');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is blacklisted (for logout)
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new AuthenticationError('Token has been revoked');
    }
    
    // 🛠️ ADD THIS LOG:
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      // 🛠️ ADD THIS LOG:
      console.error(`❌ ID [${decoded.id}] not found in DB. Token is orphaned.`);
      throw new AuthenticationError('User not found');
    }
    
    // Check if user is active
if (user.status !== 'active') { // Use 'status' instead of 'isActive'
  throw new AuthorizationError(`Account is ${user.status || 'deactivated'}`);
}

    // Attach user to request
    req.user = user;
    req.userId = user._id; // Add this line for shorthand consistency
    
    // Optional: Check token version for security
    if (user.tokenVersion && decoded.version !== user.tokenVersion) {
      throw new AuthenticationError('Token is outdated');
    }
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AuthenticationError('Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Token expired'));
    }
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new AuthorizationError('Insufficient permissions'));
    }
    
    next();
  };
};

module.exports = { auth, authorize };