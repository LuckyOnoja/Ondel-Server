import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { v2 as cloudinary } from 'cloudinary';

async function testCloudinaryConnection() {
  console.log('Testing Cloudinary credentials...');
  console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
  console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '******' : 'MISSING');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  try {
    const res = await cloudinary.api.ping();
    console.log('✅ Cloudinary Connection Successful! Ping response:', res);
  } catch (error: any) {
    console.error('❌ Cloudinary Ping Failed:', error);
  }
}

testCloudinaryConnection();
