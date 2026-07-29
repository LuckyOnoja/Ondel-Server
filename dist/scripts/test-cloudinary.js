"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), '.env') });
const cloudinary_1 = require("cloudinary");
async function testCloudinaryConnection() {
    console.log('Testing Cloudinary credentials...');
    console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
    console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '******' : 'MISSING');
    cloudinary_1.v2.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
    });
    try {
        const res = await cloudinary_1.v2.api.ping();
        console.log('✅ Cloudinary Connection Successful! Ping response:', res);
    }
    catch (error) {
        console.error('❌ Cloudinary Ping Failed:', error);
    }
}
testCloudinaryConnection();
