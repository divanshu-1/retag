/**
 * Cloudinary utility functions for frontend
 */

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/**
 * Generate optimized Cloudinary URL with transformations
 */
export function generateCloudinaryUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string | number;
    format?: string;
    gravity?: string;
  } = {}
): string {
  if (!CLOUDINARY_CLOUD_NAME) {
    console.warn('Cloudinary cloud name not configured');
    return publicId; // Return original if not configured
  }

  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  
  const transformations: string[] = [];
  
  if (options.quality) {
    transformations.push(`q_${options.quality}`);
  }
  
  if (options.format) {
    transformations.push(`f_${options.format}`);
  }
  
  if (options.width && options.height) {
    transformations.push(`w_${options.width},h_${options.height}`);
  } else if (options.width) {
    transformations.push(`w_${options.width}`);
  } else if (options.height) {
    transformations.push(`h_${options.height}`);
  }
  
  if (options.crop) {
    transformations.push(`c_${options.crop}`);
  }
  
  if (options.gravity) {
    transformations.push(`g_${options.gravity}`);
  }
  
  const transformationString = transformations.length > 0 
    ? `/${transformations.join(',')}`
    : '';
  
  return `${baseUrl}${transformationString}/${publicId}`;
}

/**
 * Generate responsive image URLs for different screen sizes
 */
export function generateResponsiveUrls(publicId: string): {
  thumbnail: string;
  small: string;
  medium: string;
  large: string;
  original: string;
} {
  return {
    thumbnail: generateCloudinaryUrl(publicId, { 
      width: 150, 
      height: 150, 
      crop: 'fill',
      quality: 'auto:good',
      format: 'auto'
    }),
    small: generateCloudinaryUrl(publicId, { 
      width: 400, 
      height: 400, 
      crop: 'fill',
      quality: 'auto:good',
      format: 'auto'
    }),
    medium: generateCloudinaryUrl(publicId, { 
      width: 800, 
      height: 800, 
      crop: 'fill',
      quality: 'auto:good',
      format: 'auto'
    }),
    large: generateCloudinaryUrl(publicId, { 
      width: 1200, 
      height: 1200, 
      crop: 'fill',
      quality: 'auto:good',
      format: 'auto'
    }),
    original: generateCloudinaryUrl(publicId, {
      quality: 'auto:good',
      format: 'auto'
    })
  };
}

/**
 * Generate thumbnail URL
 */
export function generateThumbnail(publicId: string, size: number = 200): string {
  return generateCloudinaryUrl(publicId, {
    width: size,
    height: size,
    crop: 'fill',
    quality: 'auto:good',
    format: 'auto'
  });
}

/**
 * Extract public ID from Cloudinary URL
 */
export function extractPublicId(cloudinaryUrl: string): string {
  if (!cloudinaryUrl.includes('cloudinary.com')) {
    return cloudinaryUrl; // Not a Cloudinary URL
  }
  
  const matches = cloudinaryUrl.match(/\/v\d+\/(.+)\./);
  return matches ? matches[1] : '';
}

/**
 * Check if URL is a Cloudinary URL
 */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes('res.cloudinary.com') || url.includes('cloudinary.com');
}

/**
 * Generate product card image URL with optimal settings
 */
export function generateProductCardImage(publicId: string): string {
  return generateCloudinaryUrl(publicId, {
    width: 400,
    height: 400,
    crop: 'fill',
    quality: 'auto:good',
    format: 'auto',
    gravity: 'center'
  });
}

/**
 * Generate product detail image URL with optimal settings
 */
export function generateProductDetailImage(publicId: string): string {
  return generateCloudinaryUrl(publicId, {
    width: 800,
    height: 800,
    crop: 'fill',
    quality: 'auto:good',
    format: 'auto',
    gravity: 'center'
  });
}

/**
 * Generate image URL for mobile devices
 */
export function generateMobileImage(publicId: string): string {
  return generateCloudinaryUrl(publicId, {
    width: 400,
    height: 400,
    crop: 'fill',
    quality: 'auto:eco',
    format: 'auto',
    gravity: 'center'
  });
}

/**
 * Generate image URL for retina displays
 */
export function generateRetinaImage(publicId: string, baseWidth: number = 400): string {
  return generateCloudinaryUrl(publicId, {
    width: baseWidth * 2,
    height: baseWidth * 2,
    crop: 'fill',
    quality: 'auto:good',
    format: 'auto',
    gravity: 'center'
  });
}

/**
 * Generate blurred placeholder image for loading states
 */
export function generateBlurredPlaceholder(publicId: string): string {
  return generateCloudinaryUrl(publicId, {
    width: 50,
    height: 50,
    crop: 'fill',
    quality: 'auto:low',
    format: 'auto',
    gravity: 'center'
  });
}
