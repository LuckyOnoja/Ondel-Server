import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { uploadAudioToCloudinary } from '../config/cloudinary.js';

async function testUpload() {
  const dummyFilePath = path.join(process.cwd(), 'uploads', 'demos', 'test_sample.mp3');

  // Create a small dummy mp3 file for testing if it doesn't exist
  if (!fs.existsSync(dummyFilePath)) {
    const dir = path.dirname(dummyFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dummyFilePath, Buffer.from('ID3...dummy mp3 content...'));
  }

  console.log('Testing upload of file:', dummyFilePath);
  try {
    const url = await uploadAudioToCloudinary(dummyFilePath, 'test_sample.mp3');
    console.log('✅ Upload Success! Cloudinary URL:', url);
  } catch (err) {
    console.error('❌ Upload Failed:', err);
  }
}

testUpload();
