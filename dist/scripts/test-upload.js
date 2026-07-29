"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), '.env') });
const cloudinary_js_1 = require("../config/cloudinary.js");
async function testUpload() {
    const dummyFilePath = path_1.default.join(process.cwd(), 'uploads', 'demos', 'test_sample.mp3');
    // Create a small dummy mp3 file for testing if it doesn't exist
    if (!fs_1.default.existsSync(dummyFilePath)) {
        const dir = path_1.default.dirname(dummyFilePath);
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        fs_1.default.writeFileSync(dummyFilePath, Buffer.from('ID3...dummy mp3 content...'));
    }
    console.log('Testing upload of file:', dummyFilePath);
    try {
        const url = await (0, cloudinary_js_1.uploadAudioToCloudinary)(dummyFilePath, 'test_sample.mp3');
        console.log('✅ Upload Success! Cloudinary URL:', url);
    }
    catch (err) {
        console.error('❌ Upload Failed:', err);
    }
}
testUpload();
