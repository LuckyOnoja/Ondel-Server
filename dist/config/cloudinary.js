"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinary = void 0;
exports.isCloudinaryConfigured = isCloudinaryConfigured;
exports.initCloudinary = initCloudinary;
exports.uploadAudioToCloudinary = uploadAudioToCloudinary;
const cloudinary_1 = require("cloudinary");
Object.defineProperty(exports, "cloudinary", { enumerable: true, get: function () { return cloudinary_1.v2; } });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Ensure .env is loaded
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), '.env') });
function isCloudinaryConfigured() {
    return Boolean((process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET) ||
        process.env.CLOUDINARY_URL);
}
function initCloudinary() {
    if (!isCloudinaryConfigured())
        return false;
    if (process.env.CLOUDINARY_URL) {
        cloudinary_1.v2.config({
            cloudinary_url: process.env.CLOUDINARY_URL,
        });
    }
    else {
        cloudinary_1.v2.config({
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
async function uploadAudioToCloudinary(filePath, filename) {
    initCloudinary();
    const publicId = filename ? `${Date.now()}-${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}` : undefined;
    try {
        // Attempt auto resource type first
        return await new Promise((resolve, reject) => {
            cloudinary_1.v2.uploader.upload(filePath, {
                resource_type: 'auto',
                folder: 'ondel_songs',
                public_id: publicId,
                overwrite: true,
            }, (error, result) => {
                if (error)
                    return reject(error);
                if (!result?.secure_url)
                    return reject(new Error('No secure_url returned'));
                resolve(result.secure_url);
            });
        });
    }
    catch {
        // Fallback to raw resource type if media container parsing is strict
        return await new Promise((resolve, reject) => {
            cloudinary_1.v2.uploader.upload(filePath, {
                resource_type: 'raw',
                folder: 'ondel_songs',
                public_id: publicId,
                overwrite: true,
            }, (error, result) => {
                if (error) {
                    console.error('[Cloudinary Upload Error]:', error);
                    return reject(error);
                }
                if (!result?.secure_url)
                    return reject(new Error('No secure_url returned'));
                resolve(result.secure_url);
            });
        });
    }
}
