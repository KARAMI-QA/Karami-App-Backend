import { Storage } from '@google-cloud/storage';
import 'dotenv/config';

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: process.env.GCP_SERVICE_ACCOUNT_KEY 
    ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
    : undefined,
});

const bucketName = process.env.GCS_BUCKET_NAME || 'hrm-karami-chats';
const bucket = storage.bucket(bucketName);

// Generate signed URL for upload
export const generateUploadURL = async ({ fileName, contentType, expiresIn = 15 * 60 }) => {
  try {
    const options = {
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresIn * 1000, // Convert to milliseconds
      contentType,
    };

    const [signedUrl] = await bucket.file(fileName).getSignedUrl(options);
    
    return {
      signedUrl,
      publicUrl: `https://storage.googleapis.com/${bucketName}/${fileName}`,
      fileName,
      expires: new Date(Date.now() + expiresIn * 1000).toISOString()
    };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    throw new Error('Failed to generate upload URL');
  }
};

// Generate signed URL for download (if files are private)
export const generateDownloadURL = async ({ fileName, expiresIn = 60 * 60 }) => {
  try {
    const options = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    };

    const [signedUrl] = await bucket.file(fileName).getSignedUrl(options);
    
    return {
      signedUrl,
      expires: new Date(Date.now() + expiresIn * 1000).toISOString()
    };
  } catch (error) {
    console.error('Error generating download URL:', error);
    throw new Error('Failed to generate download URL');
  }
};

// Delete file from GCS
export const deleteFile = async (fileName) => {
  try {
    await bucket.file(fileName).delete();
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// Check if file exists
export const fileExists = async (fileName) => {
  try {
    const [exists] = await bucket.file(fileName).exists();
    return exists;
  } catch (error) {
    console.error('Error checking file existence:', error);
    return false;
  }
};

// Get file metadata
export const getFileMetadata = async (fileName) => {
  try {
    const [metadata] = await bucket.file(fileName).getMetadata();
    return metadata;
  } catch (error) {
    console.error('Error getting file metadata:', error);
    return null;
  }
};

// Make file publicly accessible
export const makeFilePublic = async (fileName) => {
  try {
    await bucket.file(fileName).makePublic();
    return `https://storage.googleapis.com/${bucketName}/${fileName}`;
  } catch (error) {
    console.error('Error making file public:', error);
    throw new Error('Failed to make file public');
  }
};

export default {
  generateUploadURL,
  generateDownloadURL,
  deleteFile,
  fileExists,
  getFileMetadata,
  makeFilePublic,
  bucketName
};