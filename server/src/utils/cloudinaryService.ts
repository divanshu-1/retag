import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  bytes: number;
}

export interface UploadOptions {
  folder?: string;
  transformation?: any[];
  quality?: string | number;
  format?: string;
  width?: number;
  height?: number;
  crop?: string;
}

class CloudinaryService {
  /**
   * Upload a file buffer to Cloudinary
   */
  async uploadBuffer(
    buffer: Buffer,
    options: UploadOptions = {}
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: options.folder || 'retag/products',
        quality: options.quality || 'auto:good',
        fetch_format: 'auto',
        transformation: options.transformation || [],
        ...options,
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else if (result) {
            resolve(result as CloudinaryUploadResult);
          } else {
            reject(new Error('Upload failed - no result returned'));
          }
        }
      );

      // Convert buffer to stream and pipe to Cloudinary
      const bufferStream = new Readable();
      bufferStream.push(buffer);
      bufferStream.push(null);
      bufferStream.pipe(uploadStream);
    });
  }

  /**
   * Upload multiple files to Cloudinary
   */
  async uploadMultiple(
    files: Express.Multer.File[],
    options: UploadOptions = {}
  ): Promise<CloudinaryUploadResult[]> {
    const uploadPromises = files.map((file, index) => {
      const fileOptions = {
        ...options,
        public_id: options.folder 
          ? `${options.folder}/image_${Date.now()}_${index}`
          : `retag/products/image_${Date.now()}_${index}`,
      };
      return this.uploadBuffer(file.buffer, fileOptions);
    });

    return Promise.all(uploadPromises);
  }

  /**
   * Delete an image from Cloudinary
   */
  async deleteImage(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      console.error('Error deleting image from Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Delete multiple images from Cloudinary
   */
  async deleteMultiple(publicIds: string[]): Promise<any> {
    try {
      const result = await cloudinary.api.delete_resources(publicIds);
      return result;
    } catch (error) {
      console.error('Error deleting multiple images from Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Generate optimized URL with transformations
   */
  generateOptimizedUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      crop?: string;
      quality?: string | number;
      format?: string;
    } = {}
  ): string {
    return cloudinary.url(publicId, {
      quality: options.quality || 'auto:good',
      format: options.format || 'auto',
      width: options.width,
      height: options.height,
      crop: options.crop || 'fill',
      secure: true,
    });
  }

  /**
   * Generate thumbnail URL
   */
  generateThumbnail(publicId: string, size: number = 200): string {
    return this.generateOptimizedUrl(publicId, {
      width: size,
      height: size,
      crop: 'fill',
      quality: 'auto:good',
    });
  }

  /**
   * Generate responsive image URLs for different screen sizes
   */
  generateResponsiveUrls(publicId: string): {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
    original: string;
  } {
    return {
      thumbnail: this.generateThumbnail(publicId, 150),
      small: this.generateOptimizedUrl(publicId, { width: 400, height: 400 }),
      medium: this.generateOptimizedUrl(publicId, { width: 800, height: 800 }),
      large: this.generateOptimizedUrl(publicId, { width: 1200, height: 1200 }),
      original: cloudinary.url(publicId, { secure: true }),
    };
  }

  /**
   * Extract public ID from Cloudinary URL
   */
  extractPublicId(cloudinaryUrl: string): string {
    const matches = cloudinaryUrl.match(/\/v\d+\/(.+)\./);
    return matches ? matches[1] : '';
  }

  /**
   * Generate auto-optimized URL for web delivery
   */
  generateWebOptimizedUrl(publicId: string, width?: number, height?: number): string {
    return cloudinary.url(publicId, {
      quality: 'auto:good',
      format: 'auto',
      width: width,
      height: height,
      crop: width && height ? 'fill' : undefined,
      secure: true,
      fetch_format: 'auto',
      flags: 'progressive',
    });
  }

  /**
   * Generate SEO-friendly URLs with descriptive names
   */
  generateSeoFriendlyUrl(
    publicId: string,
    productName: string,
    options: { width?: number; height?: number } = {}
  ): string {
    const seoName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    return cloudinary.url(publicId, {
      quality: 'auto:good',
      format: 'auto',
      width: options.width,
      height: options.height,
      crop: options.width && options.height ? 'fill' : undefined,
      secure: true,
      public_id: `${publicId}/${seoName}`,
    });
  }

  /**
   * Check if Cloudinary is properly configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }
}

export default new CloudinaryService();
