const path = require('path');
const sharp = require('sharp');

module.exports = (plugin) => {
  // Override the upload controller to add image optimization
  plugin.controllers.upload.upload = async (ctx) => {
    const { files } = ctx.request;

    if (!files || Object.keys(files).length === 0) {
      return ctx.badRequest('No files provided');
    }

    const uploadedFiles = [];

    for (const [key, file] of Object.entries(files)) {
      try {
        // Process image files for optimization
        if (file.type.startsWith('image/')) {
          const processedFile = await processImage(file);
          const uploaded = await strapi.plugins.upload.services.upload.upload({
            data: {
              fileInfo: {
                name: processedFile.name,
                caption: processedFile.caption,
                alternativeText: processedFile.alternativeText
              }
            },
            files: processedFile
          });
          uploadedFiles.push(...uploaded);
        } else {
          // Upload non-image files normally
          const uploaded = await strapi.plugins.upload.services.upload.upload({
            data: {
              fileInfo: {
                name: file.name,
                caption: file.caption,
                alternativeText: file.alternativeText
              }
            },
            files: file
          });
          uploadedFiles.push(...uploaded);
        }
      } catch (error) {
        strapi.log.error('File upload error:', error);
        return ctx.badRequest(`Upload failed for ${file.name}: ${error.message}`);
      }
    }

    // Generate responsive image variants
    for (const file of uploadedFiles) {
      if (file.mime.startsWith('image/')) {
        setTimeout(() => generateResponsiveVariants(file), 1000);
      }
    }

    return uploadedFiles;
  };

  // Add endpoint for image optimization
  plugin.routes['content-api'].routes.push({
    method: 'POST',
    path: '/upload/optimize',
    handler: 'upload.optimizeImage',
    config: {
      policies: []
    }
  });

  plugin.controllers.upload.optimizeImage = async (ctx) => {
    const { id, quality = 80, width, height, format } = ctx.request.body;

    try {
      const file = await strapi.plugins.upload.services.upload.findOne(id);
      if (!file) {
        return ctx.notFound('File not found');
      }

      if (!file.mime.startsWith('image/')) {
        return ctx.badRequest('File is not an image');
      }

      const optimizedFile = await optimizeImage(file, {
        quality: parseInt(quality),
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        format
      });

      return optimizedFile;
    } catch (error) {
      strapi.log.error('Image optimization error:', error);
      return ctx.badRequest(`Optimization failed: ${error.message}`);
    }
  };

  return plugin;
};

// Image processing function
async function processImage(file) {
  try {
    if (!file.type.startsWith('image/')) {
      return file;
    }

    const image = sharp(file.path || file.buffer);
    const metadata = await image.metadata();

    // Auto-rotate based on EXIF data
    image.rotate();

    // Optimize based on file type
    if (file.type === 'image/jpeg') {
      image.jpeg({ quality: 85, mozjpeg: true });
    } else if (file.type === 'image/png') {
      image.png({ quality: 85, compressionLevel: 8 });
    } else if (file.type === 'image/webp') {
      image.webp({ quality: 85 });
    }

    // Resize if image is too large
    if (metadata.width > 2048) {
      image.resize(2048, null, {
        withoutEnlargement: true,
        fit: 'inside'
      });
    }

    // Generate optimized buffer
    const optimizedBuffer = await image.toBuffer();

    // Update file properties
    file.size = optimizedBuffer.length;
    file.buffer = optimizedBuffer;

    // Generate alt text suggestion based on filename
    if (!file.alternativeText) {
      file.alternativeText = generateAltText(file.name);
    }

    return file;
  } catch (error) {
    strapi.log.error('Image processing error:', error);
    return file; // Return original file if processing fails
  }
}

// Generate responsive image variants
async function generateResponsiveVariants(file) {
  try {
    const variants = [
      { suffix: '_sm', width: 400, quality: 80 },
      { suffix: '_md', width: 800, quality: 85 },
      { suffix: '_lg', width: 1200, quality: 85 },
      { suffix: '_xl', width: 1600, quality: 90 }
    ];

    const originalBuffer = await fetch(file.url).then(res => res.buffer());
    const image = sharp(originalBuffer);
    const metadata = await image.metadata();

    for (const variant of variants) {
      // Skip if original is smaller than variant
      if (metadata.width <= variant.width) continue;

      const variantImage = image.clone()
        .resize(variant.width, null, {
          withoutEnlargement: true,
          fit: 'inside'
        });

      // Apply format-specific optimization
      if (file.ext === '.jpg' || file.ext === '.jpeg') {
        variantImage.jpeg({ quality: variant.quality, mozjpeg: true });
      } else if (file.ext === '.png') {
        variantImage.png({ quality: variant.quality });
      } else if (file.ext === '.webp') {
        variantImage.webp({ quality: variant.quality });
      }

      const variantBuffer = await variantImage.toBuffer();

      // Save variant (in production, you'd upload to CDN)
      const variantName = file.name.replace(file.ext, `${variant.suffix}${file.ext}`);

      // This would typically be saved to your CDN
      strapi.log.info(`Generated variant: ${variantName} (${variantBuffer.length} bytes)`);
    }
  } catch (error) {
    strapi.log.error('Responsive variant generation error:', error);
  }
}

// Optimize existing image
async function optimizeImage(file, options = {}) {
  try {
    const { quality = 80, width, height, format } = options;

    const response = await fetch(file.url);
    const buffer = await response.buffer();

    let image = sharp(buffer);

    // Resize if dimensions provided
    if (width || height) {
      image = image.resize(width, height, {
        withoutEnlargement: true,
        fit: 'inside'
      });
    }

    // Convert format if specified
    if (format) {
      switch (format.toLowerCase()) {
        case 'webp':
          image = image.webp({ quality });
          break;
        case 'jpeg':
        case 'jpg':
          image = image.jpeg({ quality, mozjpeg: true });
          break;
        case 'png':
          image = image.png({ quality });
          break;
        case 'avif':
          image = image.avif({ quality });
          break;
      }
    } else {
      // Apply quality to original format
      if (file.mime === 'image/jpeg') {
        image = image.jpeg({ quality, mozjpeg: true });
      } else if (file.mime === 'image/png') {
        image = image.png({ quality });
      } else if (file.mime === 'image/webp') {
        image = image.webp({ quality });
      }
    }

    const optimizedBuffer = await image.toBuffer();
    const metadata = await sharp(optimizedBuffer).metadata();

    return {
      buffer: optimizedBuffer,
      size: optimizedBuffer.length,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      compressionRatio: ((file.size - optimizedBuffer.length) / file.size * 100).toFixed(2)
    };
  } catch (error) {
    throw new Error(`Image optimization failed: ${error.message}`);
  }
}

// Generate alt text from filename
function generateAltText(filename) {
  return filename
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
    .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
    .trim();
}

// Add image validation
function validateImage(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid image type: ${file.type}`);
  }

  if (file.size > maxSize) {
    throw new Error(`Image too large: ${file.size} bytes (max: ${maxSize})`);
  }

  return true;
}