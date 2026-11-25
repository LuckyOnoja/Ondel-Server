import { cloudinary, initCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  resourceType: 'image' | 'video' | 'raw';
  duration?: number;
  bytes?: number;
}

function detectResourceType(fileName: string, mimeType?: string): 'image' | 'video' | 'raw' {
  const lowerName = (fileName || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();

  if (
    lowerMime.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg|bmp|tiff?)$/i.test(lowerName)
  ) {
    return 'image';
  }

  if (
    lowerMime.startsWith('video/') ||
    lowerMime.startsWith('audio/') ||
    /\.(mp4|mov|m4v|webm|mkv|avi|mp3|wav|aif|aiff|flac|m4a|aac|ogg|wma)$/i.test(lowerName)
  ) {
    return 'video';
  }

  return 'raw';
}

function sanitizeBaseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const clean = base.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 60);
  return clean || 'file';
}

function extractExt(fileName: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(fileName || '');
  return match ? match[1].toLowerCase() : '';
}

export class CloudinaryService {
  static async uploadMediaBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType?: string,
    options: { folder?: string; maxDurationSeconds?: number } = {}
  ): Promise<CloudinaryUploadResult> {
    initCloudinary();
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary is not configured on the server.');
    }

    const folder = options.folder || 'ondel_vault';
    const resourceType = detectResourceType(fileName, mimeType);
    const ext = extractExt(fileName);
    const base = sanitizeBaseName(fileName);
    // For raw files (PDF/DOC/DOCX), keep the extension in public_id so Cloudinary serves the proper filename/extension.
    const publicId =
      resourceType === 'raw' && ext
        ? `${Date.now()}-${base}.${ext}`
        : `${Date.now()}-${base}`;

    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          public_id: publicId,
          overwrite: false,
        },
        (error, res) => {
          if (error || !res) {
            return reject(error || new Error('Cloudinary upload failed'));
          }
          resolve(res);
        }
      );

      uploadStream.end(buffer);
    });

    // Strict server-side duration enforcement (e.g., max 10 seconds for cover videos)
    if (
      typeof options.maxDurationSeconds === 'number' &&
      resourceType === 'video' &&
      typeof result.duration === 'number' &&
      result.duration > options.maxDurationSeconds + 0.25
    ) {
      await cloudinary.uploader.destroy(result.public_id, { resource_type: 'video' }).catch(() => null);
      throw new Error(
        `Video must be ${options.maxDurationSeconds} seconds or shorter (uploaded video is ${Math.round(result.duration * 10) / 10}s).`
      );
    }

    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType,
      duration: typeof result.duration === 'number' ? result.duration : undefined,
      bytes: typeof result.bytes === 'number' ? result.bytes : undefined,
    };
  }

  static async uploadProofBuffer(buffer: Buffer, folder = 'submission_proofs'): Promise<string> {
    initCloudinary();
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error('Cloudinary upload failed'));
          }
          resolve(result.secure_url);
        }
      );

      uploadStream.end(buffer);
    });
  }

  static async uploadBase64Proof(base64Image: string, folder = 'submission_proofs'): Promise<string> {
    initCloudinary();
    const res = await cloudinary.uploader.upload(base64Image, {
      folder,
      resource_type: 'image',
    });
    return res.secure_url;
  }

  static async uploadAudioBuffer(buffer: Buffer, folder = 'song_demos'): Promise<string> {
    initCloudinary();
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'video',
        },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error('Cloudinary audio upload failed'));
          }
          resolve(result.secure_url);
        }
      );

      uploadStream.end(buffer);
    });
  }

  static async destroyResource(publicId: string): Promise<void> {
    initCloudinary();
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' }).catch(() => null);
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => null);
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }).catch(() => null);
    } catch (err) {
      console.warn('[CloudinaryService] destroyResource warning:', err);
    }
  }
}
