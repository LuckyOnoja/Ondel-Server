import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'ondel-music',
  api_key: process.env.CLOUDINARY_API_KEY || '123456789',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'secret',
});

export class CloudinaryService {
  static async uploadProofBuffer(buffer: Buffer, folder = 'submission_proofs'): Promise<string> {
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
    const res = await cloudinary.uploader.upload(base64Image, {
      folder,
      resource_type: 'image',
    });
    return res.secure_url;
  }

  static async uploadAudioBuffer(buffer: Buffer, folder = 'song_demos'): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'video', // Cloudinary uses resource_type 'video' or 'auto' for audio files (.mp3, .wav)
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
}
