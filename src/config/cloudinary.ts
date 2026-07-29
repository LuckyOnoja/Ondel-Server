import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded
dotenv.config({ path: path.join(process.cwd(), '.env') });

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    (process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET) ||
      process.env.CLOUDINARY_URL
  );
}

export function initCloudinary() {
  if (!isCloudinaryConfigured()) return false;

  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloudinary_url: process.env.CLOUDINARY_URL,
    });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  return true;
}

// Auto-initialize on module load
initCloudinary();

export { cloudinary };

export async function uploadAudioToCloudinary(filePath: string, filename?: string): Promise<string> {
  initCloudinary();

  const publicId = filename ? `${Date.now()}-${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}` : undefined;

  try {
    // Attempt auto resource type first
    return await new Promise<string>((resolve, reject) => {
      cloudinary.uploader.upload(
        filePath,
        {
          resource_type: 'auto',
          folder: 'ondel_songs',
          public_id: publicId,
          overwrite: true,
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result?.secure_url) return reject(new Error('No secure_url returned'));
          resolve(result.secure_url);
        }
      );
    });
  } catch {
    // Fallback to raw resource type if media container parsing is strict
    return await new Promise<string>((resolve, reject) => {
      cloudinary.uploader.upload(
        filePath,
        {
          resource_type: 'raw',
          folder: 'ondel_songs',
          public_id: publicId,
          overwrite: true,
        },
        (error, result) => {
          if (error) {
            console.error('[Cloudinary Upload Error]:', error);
            return reject(error);
          }
          if (!result?.secure_url) return reject(new Error('No secure_url returned'));
          resolve(result.secure_url);
        }
      );
    });
  }
}
