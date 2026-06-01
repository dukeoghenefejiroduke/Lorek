const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const { logger } = require('../config/logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload file to Cloudinary
 * @param {string} filePath - Local file path
 * @param {object} options - Upload options
 * @returns {Promise<object>} Upload result
 */
const uploadToCloudinary = async (filePath, options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: options.folder || 'izon-app',
      transformation: options.transformation || [],
      ...options,
    });
    return result;
  } catch (error) {
    logger.error('Cloudinary upload error:', error);
    throw error;
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID or URL
 * @returns {Promise<object>} Delete result
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    // Extract public ID from URL if needed
    let id = publicId;
    if (publicId.includes('cloudinary.com')) {
      const parts = publicId.split('/');
      const filename = parts[parts.length - 1];
      id = filename.split('.')[0];
    }
    
    const result = await cloudinary.uploader.destroy(id);
    return result;
  } catch (error) {
    logger.error('Cloudinary delete error:', error);
    throw error;
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
};