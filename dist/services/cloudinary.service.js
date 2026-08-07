"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudinaryService = void 0;
const cloudinary_1 = require("cloudinary");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'ondel-music',
    api_key: process.env.CLOUDINARY_API_KEY || '123456789',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'secret',
});
class CloudinaryService {
    static async uploadProofBuffer(buffer, folder = 'submission_proofs') {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                folder,
                resource_type: 'image',
            }, (error, result) => {
                if (error || !result) {
                    return reject(error || new Error('Cloudinary upload failed'));
                }
                resolve(result.secure_url);
            });
            uploadStream.end(buffer);
        });
    }
    static async uploadBase64Proof(base64Image, folder = 'submission_proofs') {
        const res = await cloudinary_1.v2.uploader.upload(base64Image, {
            folder,
            resource_type: 'image',
        });
        return res.secure_url;
    }
    static async uploadAudioBuffer(buffer, folder = 'song_demos') {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                folder,
                resource_type: 'video', // Cloudinary uses resource_type 'video' or 'auto' for audio files (.mp3, .wav)
            }, (error, result) => {
                if (error || !result) {
                    return reject(error || new Error('Cloudinary audio upload failed'));
                }
                resolve(result.secure_url);
            });
            uploadStream.end(buffer);
        });
    }
    static async destroyResource(publicId) {
        try {
            await cloudinary_1.v2.uploader.destroy(publicId, { resource_type: 'video' }).catch(() => null);
            await cloudinary_1.v2.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => null);
            await cloudinary_1.v2.uploader.destroy(publicId, { resource_type: 'raw' }).catch(() => null);
        }
        catch (err) {
            console.warn('[CloudinaryService] destroyResource warning:', err);
        }
    }
}
exports.CloudinaryService = CloudinaryService;
