import { Storage } from '@google-cloud/storage';
import 'dotenv/config';
import sharp from 'sharp';  // Make sure sharp is also imported
import ffmpeg from 'fluent-ffmpeg';  // Make sure ffmpeg is imported
import os from 'os';  // Add this
import fs from 'fs';  // Add this
import path from 'path';  // Add this
import { v4 as uuidv4 } from 'uuid'; 
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ffprobeStatic = require('ffprobe-static');

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: process.env.GCP_SERVICE_ACCOUNT_KEY 
    ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
    : undefined,
});

const bucketName = process.env.GCS_BUCKET_NAME || 'hrm-karami-chats';
const bucket = storage.bucket(bucketName);

export const compressImage = async (fileBuffer, contentType) => {
    try {
      const image = sharp(fileBuffer);
      
      // Get image metadata
      const metadata = await image.metadata();
      
      // Calculate new dimensions while maintaining aspect ratio
      let width = metadata.width;
      let height = metadata.height;
      
      // Maximum dimensions for compressed images
      const MAX_WIDTH = 1920;
      const MAX_HEIGHT = 1080;
      
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        if (width / height > MAX_WIDTH / MAX_HEIGHT) {
          width = MAX_WIDTH;
          height = Math.round((MAX_WIDTH * metadata.height) / metadata.width);
        } else {
          height = MAX_HEIGHT;
          width = Math.round((MAX_HEIGHT * metadata.width) / metadata.height);
        }
      }
      
      // Resize and compress based on format
      let compressedImage;
      if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
        compressedImage = await image
          .resize(width, height, { fit: 'inside' })
          .jpeg({ quality: 80, progressive: true })
          .toBuffer();
      } else if (contentType === 'image/png') {
        compressedImage = await image
          .resize(width, height, { fit: 'inside' })
          .png({ compressionLevel: 8, progressive: true })
          .toBuffer();
      } else if (contentType === 'image/webp') {
        compressedImage = await image
          .resize(width, height, { fit: 'inside' })
          .webp({ quality: 80 })
          .toBuffer();
      } else {
        // For other formats, just resize without format conversion
        compressedImage = await image
          .resize(width, height, { fit: 'inside' })
          .toBuffer();
      }
      
      console.log(`📊 Image compressed from ${fileBuffer.length} to ${compressedImage.length} bytes`);
      return compressedImage;
    } catch (error) {
      console.error('Error compressing image:', error);
      return fileBuffer; // Return original if compression fails
    }
  };

 export const compressVideo = async (fileBuffer, fileName, originalContentType) => {
    return new Promise((resolve, reject) => {
      try {
        const tempDir = os.tmpdir();
        const uniqueId = uuidv4();
        const inputPath = path.join(tempDir, `${uniqueId}_input_${fileName}`);
        const outputPath = path.join(tempDir, `${uniqueId}_compressed.mp4`);
        
        // Write buffer to temp file
        fs.writeFileSync(inputPath, fileBuffer);
        
        console.log(`🎥 Starting video compression for: ${fileName}`);
        console.log(`📊 Original size: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
        
        ffmpeg(inputPath)
          .output(outputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-preset fast', // Faster compression preset
            '-crf 28', // Compression level (23-28 is good for web)
            '-movflags +faststart', // Optimize for web streaming
            '-max_muxing_queue_size 1024'
          ])
          .size('1280x720') // Resize to 720p if larger
          .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Processing: ${progress.percent.toFixed(2)}%`);
            }
          })
          .on('end', async () => {
            try {
              // Read compressed video
              const compressedBuffer = fs.readFileSync(outputPath);
              
              console.log(`🎥 Video compression completed!`);
              console.log(`📊 Compressed size: ${(compressedBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
              console.log(`📉 Compression ratio: ${((1 - compressedBuffer.length/fileBuffer.length) * 100).toFixed(1)}% reduction`);
              
              // Clean up temp files
              try {
                fs.unlinkSync(inputPath);
                fs.unlinkSync(outputPath);
              } catch (cleanupError) {
                console.warn('Warning: Could not clean up temp files:', cleanupError.message);
              }
              
              resolve(compressedBuffer);
            } catch (readError) {
              console.error('Error reading compressed file:', readError);
              
              // Clean up temp files
              try {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
              } catch (e) {}
              
              reject(readError);
            }
          })
          .on('error', (err) => {
            console.error('FFmpeg error:', err);
            
            // Clean up temp files
            try {
              if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (e) {}
            
            // Return original buffer if compression fails
            console.log('Returning original video due to compression error');
            resolve(fileBuffer);
          })
          .run();
      } catch (error) {
        console.error('Error in video compression setup:', error);
        // Return original if anything fails
        resolve(fileBuffer);
      }
    });
  };
  

  const getVideoDuration = (fileBuffer) => {
    return new Promise((resolve, reject) => {
      const tempDir = os.tmpdir();
      const uniqueId = uuidv4();
      const tempPath = path.join(tempDir, `${uniqueId}_duration_check.mp4`);
      
      fs.writeFileSync(tempPath, fileBuffer);
      
      ffmpeg.ffprobe(tempPath, (err, metadata) => {
        // Clean up temp file
        try { fs.unlinkSync(tempPath); } catch (e) {}
        
        if (err) {
          console.log('Could not get video duration, using default:', err.message);
          resolve(30); // Default to 30 seconds
        } else {
          const duration = metadata.format.duration || 30;
          console.log(`📅 Video duration: ${duration.toFixed(2)} seconds`);
          resolve(duration);
        }
      });
    });
  };
  
  // Helper function to compress video to under 5MB
  const compressVideoTo5MB = async (fileBuffer, fileName, originalContentType) => {
    return new Promise((resolve, reject) => {
      try {
        const tempDir = os.tmpdir();
        const uniqueId = uuidv4();
        const inputPath = path.join(tempDir, `${uniqueId}_input_${path.basename(fileName)}`);
        const outputPath = path.join(tempDir, `${uniqueId}_compressed_5mb.mp4`);
        
        // Write buffer to temp file
        fs.writeFileSync(inputPath, fileBuffer);
        
        console.log(`🎥 Starting compression to under 5MB for: ${fileName}`);
        console.log(`📊 Original size: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
        
        // First, get video duration to calculate target bitrate
        ffmpeg.ffprobe(inputPath, async (err, metadata) => {
          if (err) {
            console.log('Could not analyze video, using default settings:', err.message);
            // Use default aggressive compression
            return compressWithDefaultSettings();
          }
          
          const duration = metadata.format.duration || 30; // Default 30 seconds
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
          
          console.log(`📅 Video duration: ${duration.toFixed(2)} seconds`);
          console.log(`🎬 Original resolution: ${videoStream?.width || 'unknown'}x${videoStream?.height || 'unknown'}`);
          
          // Calculate target bitrate for 5MB total (including audio)
          // 5MB = 5 * 1024 * 1024 * 8 = 41,943,040 bits
          // Target total bitrate = total bits / duration
          const TARGET_SIZE_BITS = 5 * 1024 * 1024 * 8; // 5MB in bits
          const TARGET_TOTAL_BITRATE = Math.floor(TARGET_SIZE_BITS / duration);
          
          // Allocate 20% for audio, 80% for video
          const TARGET_VIDEO_BITRATE = Math.floor(TARGET_TOTAL_BITRATE * 0.8);
          const TARGET_AUDIO_BITRATE = Math.floor(TARGET_TOTAL_BITRATE * 0.2);
          
          console.log(`🎯 Target video bitrate: ${Math.floor(TARGET_VIDEO_BITRATE/1000)} kbps`);
          console.log(`🎵 Target audio bitrate: ${Math.floor(TARGET_AUDIO_BITRATE/1000)} kbps`);
          
          // Determine optimal resolution based on original
          let targetWidth, targetHeight;
          if (videoStream?.width && videoStream?.height) {
            const aspectRatio = videoStream.width / videoStream.height;
            
            if (videoStream.width > 1280 || videoStream.height > 720) {
              // Downscale to 720p or lower if needed
              targetHeight = 720;
              targetWidth = Math.round(720 * aspectRatio);
              
              // Ensure even dimensions
              targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1;
              targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1;
            } else {
              // Keep original resolution but make dimensions even
              targetWidth = videoStream.width % 2 === 0 ? videoStream.width : videoStream.width + 1;
              targetHeight = videoStream.height % 2 === 0 ? videoStream.height : videoStream.height + 1;
            }
          } else {
            // Default to 720p
            targetWidth = 1280;
            targetHeight = 720;
          }
          
          // Cap resolution based on bitrate
          if (TARGET_VIDEO_BITRATE < 500000) { // Less than 500kbps
            targetWidth = 640;
            targetHeight = 360;
          } else if (TARGET_VIDEO_BITRATE < 1000000) { // Less than 1Mbps
            targetWidth = 854;
            targetHeight = 480;
          }
          
          console.log(`🖼️ Target resolution: ${targetWidth}x${targetHeight}`);
          
          // Calculate CRF based on target bitrate (lower bitrate needs higher CRF)
          let crfValue = 28; // Default
          if (TARGET_VIDEO_BITRATE < 300000) crfValue = 40;
          else if (TARGET_VIDEO_BITRATE < 500000) crfValue = 35;
          else if (TARGET_VIDEO_BITRATE < 1000000) crfValue = 32;
          
          // Reduce framerate for very low bitrates
          let framerate = 30;
          if (TARGET_VIDEO_BITRATE < 300000) framerate = 15;
          else if (TARGET_VIDEO_BITRATE < 500000) framerate = 24;
          
          const command = ffmpeg(inputPath)
            .output(outputPath)
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions([
              '-preset fast',           // Good balance of speed and compression
              `-crf ${crfValue}`,       // Constant Rate Factor
              '-movflags +faststart',   // Optimize for web
              `-vf scale=${targetWidth}:${targetHeight}`, // Resize
              `-r ${framerate}`,        // Set framerate
              `-b:v ${TARGET_VIDEO_BITRATE}`, // Video bitrate
              `-maxrate ${TARGET_VIDEO_BITRATE}`, // Maximum bitrate
              `-bufsize ${TARGET_VIDEO_BITRATE * 2}`, // Buffer size
              `-b:a ${TARGET_AUDIO_BITRATE}`, // Audio bitrate
              '-ac 2',                  // Stereo audio
              '-ar 44100',              // Audio sample rate
              '-profile:v baseline',    // More compatible profile
              '-level 3.0',             // H.264 level
              '-pix_fmt yuv420p',       // More compatible pixel format
              '-max_muxing_queue_size 9999'
            ])
            .on('start', (commandLine) => {
              console.log('Compressing to under 5MB...');
            })
            .on('progress', (progress) => {
              if (progress.percent) {
                console.log(`Processing: ${progress.percent.toFixed(2)}%`);
              }
            })
            .on('end', async () => {
              try {
                // Read compressed video
                const compressedBuffer = fs.readFileSync(outputPath);
                
                console.log(`✅ Video compression completed!`);
                console.log(`📊 Final size: ${(compressedBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
                
                // If still over 5MB, apply additional compression
                if (compressedBuffer.length > 5 * 1024 * 1024) {
                  console.log('⚠️ Still over 5MB, applying extra compression...');
                  const extraCompressedBuffer = await applyExtraCompression(compressedBuffer, inputPath, outputPath);
                  
                  // Clean up temp files
                  try {
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                  } catch (cleanupError) {
                    console.warn('Warning: Could not clean up temp files:', cleanupError.message);
                  }
                  
                  resolve(extraCompressedBuffer);
                } else {
                  // Clean up temp files
                  try {
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                  } catch (cleanupError) {
                    console.warn('Warning: Could not clean up temp files:', cleanupError.message);
                  }
                  
                  resolve(compressedBuffer);
                }
              } catch (readError) {
                console.error('Error reading compressed file:', readError);
                // Clean up and return original
                cleanupTempFiles();
                resolve(fileBuffer);
              }
            })
            .on('error', (err) => {
              console.error('FFmpeg error:', err.message);
              cleanupTempFiles();
              resolve(fileBuffer); // Return original if compression fails
            });
          
          command.run();
        });
        
        // Helper function for extra compression
        const applyExtraCompression = async (buffer, inputPath, outputPath) => {
          return new Promise((resolve) => {
            // Write the already compressed buffer to a new temp file
            const extraInputPath = outputPath + '_extra';
            fs.writeFileSync(extraInputPath, buffer);
            
            const extraOutputPath = outputPath + '_final';
            
            ffmpeg(extraInputPath)
              .output(extraOutputPath)
              .videoCodec('libx264')
              .audioCodec('aac')
              .outputOptions([
                '-preset ultrafast',
                '-crf 45',               // Very high compression
                '-vf scale=480:270',     // Very low resolution
                '-r 15',                 // Very low framerate
                '-b:v 200k',             // Very low bitrate
                '-b:a 32k',              // Very low audio quality
                '-ac 1',                 // Mono audio
                '-ar 22050'              // Low sample rate
              ])
              .on('end', () => {
                const finalBuffer = fs.readFileSync(extraOutputPath);
                console.log(`🔥 Extra compression applied. Final size: ${(finalBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
                
                // Clean up extra temp files
                try {
                  fs.unlinkSync(extraInputPath);
                  fs.unlinkSync(extraOutputPath);
                } catch (e) {}
                
                resolve(finalBuffer);
              })
              .on('error', () => {
                // If extra compression fails, return the already compressed buffer
                resolve(buffer);
              })
              .run();
          });
        };
        
        // Helper function to clean up temp files
        const cleanupTempFiles = () => {
          try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          } catch (e) {}
        };
        
      } catch (error) {
        console.error('Error in video compression setup:', error);
        resolve(fileBuffer); // Return original if anything fails
      }
    });
  };
  
  // Updated upload function to use 5MB compression
  export const uploadAndMakePublic = async ({ fileName, contentType, fileBuffer, shouldCompress = true }) => {
    try {
      console.log('📤 Uploading file:', fileName);
      console.log(`📁 Original size: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
      
      let finalBuffer = fileBuffer;
      let finalContentType = contentType;
      let compressionInfo = null;
      
      // Determine file type
      const extension = fileName.split('.').pop().toLowerCase();
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'];
      const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v', '3gp', 'mpg', 'mpeg'];
      
      // Apply compression if requested
      if (shouldCompress) {
        if (imageExtensions.includes(extension) || contentType.startsWith('image/')) {
          console.log('🖼️ Compressing image...');
          const startTime = Date.now();
          finalBuffer = await compressImage(fileBuffer, contentType);
          const compressionTime = Date.now() - startTime;
          compressionInfo = {
            type: 'image',
            originalSize: fileBuffer.length,
            compressedSize: finalBuffer.length,
            reduction: ((1 - finalBuffer.length/fileBuffer.length) * 100).toFixed(1),
            time: compressionTime
          };
        } else if (videoExtensions.includes(extension) || contentType.startsWith('video/')) {
          console.log('🎥 Compressing video to under 5MB...');
          const startTime = Date.now();
          finalBuffer = await compressVideoTo5MB(fileBuffer, fileName, contentType);
          const compressionTime = Date.now() - startTime;
          
          // Update content type to MP4 for compressed videos
          if (finalBuffer !== fileBuffer) {
            finalContentType = 'video/mp4';
          }
          
          compressionInfo = {
            type: 'video',
            originalSize: fileBuffer.length,
            compressedSize: finalBuffer.length,
            reduction: ((1 - finalBuffer.length/fileBuffer.length) * 100).toFixed(1),
            time: compressionTime,
            under5MB: finalBuffer.length <= 5 * 1024 * 1024
          };
          
          if (!compressionInfo.under5MB) {
            console.warn(`⚠️ Warning: Video is ${(finalBuffer.length / (1024 * 1024)).toFixed(2)} MB (over 5MB limit)`);
          }
        }
      }
      
      console.log(`📁 Final size: ${(finalBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
      if (compressionInfo) {
        console.log(`📉 Compression: ${compressionInfo.reduction}% reduction in ${compressionInfo.time}ms`);
        if (compressionInfo.type === 'video') {
          console.log(`✅ Under 5MB: ${compressionInfo.under5MB ? 'Yes' : 'No'}`);
        }
      }
      
      // If video is still over 5MB after compression, you might want to:
      // 1. Reject the upload
      // 2. Apply even more aggressive compression
      // 3. Truncate the video
      
      // Create file in bucket
      const file = bucket.file(fileName);
      
      // Upload metadata
      const metadata = {
        contentType: finalContentType,
        metadata: {
          cacheControl: 'public, max-age=31536000',
          contentDisposition: 'inline',
        },
      };
      
      // Add compression info if available
      if (compressionInfo) {
        metadata.metadata.originalSize = fileBuffer.length.toString();
        metadata.metadata.compressedSize = finalBuffer.length.toString();
        metadata.metadata.compressionRatio = compressionInfo.reduction + '%';
        metadata.metadata.compressionType = compressionInfo.type;
        if (compressionInfo.type === 'video') {
          metadata.metadata.under5MB = compressionInfo.under5MB.toString();
        }
      }
      
      // Upload file
      await file.save(finalBuffer, metadata);
      
      // Make the file publicly readable
      await file.makePublic();
      
      console.log('✅ File uploaded and made public');
      
      return {
        publicUrl: `https://storage.googleapis.com/${bucketName}/${fileName}`,
        fileName: fileName,
        size: finalBuffer.length,
        contentType: finalContentType,
        compressionInfo: compressionInfo
      };
    } catch (error) {
      console.error('❌ Error in uploadAndMakePublic:', error);
      throw error;
    }
  };
  
  // Update generateUploadURL to handle public files
  export const generateUploadURL = async ({ 
    fileName, 
    contentType, 
    expiresIn = 15 * 60,
    shouldCompress = true 
  }) => {
    try {
      const options = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + expiresIn * 1000,
        contentType,
      };
  
      const [signedUrl] = await bucket.file(fileName).getSignedUrl(options);
      
      // Return compression info for client to display
      const extension = fileName.split('.').pop().toLowerCase();
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'];
      const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'];
      
      let compressionSupported = false;
      let maxSizeMB = null;
      
      if (imageExtensions.includes(extension) || contentType.startsWith('image/')) {
        compressionSupported = shouldCompress;
      } else if (videoExtensions.includes(extension) || contentType.startsWith('video/')) {
        compressionSupported = shouldCompress;
        maxSizeMB = 5; // Video compression target
      }
      
      console.log('✅ Generated signed URL for upload');
      
      return {
        signedUrl,
        publicUrl: `https://storage.googleapis.com/${bucketName}/${fileName}`,
        fileName,
        expires: new Date(Date.now() + expiresIn * 1000).toISOString(),
        compressionSupported,
        maxSizeMB,
        shouldCompress
      };
    } catch (error) {
      console.error('Error generating upload URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  };

  export const compressUploadedFile = async (fileName) => {
    try {
      console.log(`🔄 Starting compression for uploaded file: ${fileName}`);
      
      // Download the file from GCS
      const file = bucket.file(fileName);
      const [exists] = await file.exists();
      
      if (!exists) {
        throw new Error(`File ${fileName} not found in bucket`);
      }
      
      // Get file metadata
      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType;
      const originalSize = parseInt(metadata.size || '0');
      
      console.log(`📊 Original size: ${(originalSize / (1024 * 1024)).toFixed(2)} MB`);
      
      // Download file to memory
      const [fileBuffer] = await file.download();
      
      let compressedBuffer;
      let finalContentType = contentType;
      let compressionInfo = null;
      
      // Determine file type
      const extension = fileName.split('.').pop().toLowerCase();
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'];
      const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'];
      
      if (imageExtensions.includes(extension) || contentType.startsWith('image/')) {
        console.log('🖼️ Compressing image...');
        const startTime = Date.now();
        compressedBuffer = await compressImage(fileBuffer, contentType);
        const compressionTime = Date.now() - startTime;
        
        compressionInfo = {
          type: 'image',
          originalSize,
          compressedSize: compressedBuffer.length,
          reduction: ((1 - compressedBuffer.length/originalSize) * 100).toFixed(1),
          time: compressionTime
        };
      } else if (videoExtensions.includes(extension) || contentType.startsWith('video/')) {
        console.log('🎥 Compressing video...');
        const startTime = Date.now();
        compressedBuffer = await compressVideoTo5MB(fileBuffer, fileName, contentType);
        const compressionTime = Date.now() - startTime;
        
        // Update content type to MP4 for compressed videos
        if (compressedBuffer !== fileBuffer) {
          finalContentType = 'video/mp4';
          // Update file extension
          const newFileName = fileName.replace(/\.[^/.]+$/, '.mp4');
          if (newFileName !== fileName) {
            // Delete old file and create new one
            await file.delete();
            fileName = newFileName;
          }
        }
        
        compressionInfo = {
          type: 'video',
          originalSize,
          compressedSize: compressedBuffer.length,
          reduction: ((1 - compressedBuffer.length/originalSize) * 100).toFixed(1),
          time: compressionTime,
          under5MB: compressedBuffer.length <= 5 * 1024 * 1024
        };
      } else {
        console.log('📄 File type does not support compression');
        return {
          fileName,
          publicUrl: `https://storage.googleapis.com/${bucketName}/${fileName}`,
          size: originalSize,
          contentType,
          compressionApplied: false
        };
      }
      
      if (compressedBuffer && compressedBuffer !== fileBuffer) {
        console.log(`📉 Compression: ${compressionInfo.reduction}% reduction`);
        
        // Upload compressed file back to GCS
        const compressedFile = bucket.file(fileName);
        
        const uploadMetadata = {
          contentType: finalContentType,
          metadata: {
            cacheControl: 'public, max-age=31536000',
            contentDisposition: 'inline',
            originalSize: originalSize.toString(),
            compressedSize: compressedBuffer.length.toString(),
            compressionRatio: compressionInfo.reduction + '%',
            compressionType: compressionInfo.type,
            ...(compressionInfo.type === 'video' ? { under5MB: compressionInfo.under5MB.toString() } : {})
          },
        };
        
        await compressedFile.save(compressedBuffer, uploadMetadata);
        await compressedFile.makePublic();
        
        console.log(`✅ Compression completed for ${fileName}`);
        
        return {
          fileName,
          publicUrl: `https://storage.googleapis.com/${bucketName}/${fileName}`,
          size: compressedBuffer.length,
          contentType: finalContentType,
          compressionInfo
        };
      } else {
        console.log('ℹ️ No compression applied');
        return {
          fileName,
          publicUrl: `https://storage.googleapis.com/${bucketName}/${fileName}`,
          size: originalSize,
          contentType,
          compressionApplied: false
        };
      }
    } catch (error) {
      console.error('❌ Error compressing uploaded file:', error);
      throw error;
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