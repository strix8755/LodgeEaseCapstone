/**
 * Direct image uploader that avoids CORS issues by storing images in Firestore with chunking
 * to handle Firestore's document size limitations
 */
export class DirectUploader {
  constructor(app) {
    this.app = app;
  }

  /**
   * Upload images using Firestore to avoid CORS completely
   * Handles large images by chunking them
   * @param {string} roomId - The room ID for reference
   * @param {Array} selectedImages - Array of image objects
   * @returns {Promise<string[]>} Array of compressed image URLs or references
   */
  async uploadImages(roomId, selectedImages) {
    // Import Firebase Firestore modules dynamically
    const { collection, addDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );
    
    // Get the db reference from the app
    const db = window.app ? window.app.$options.db : null;
    
    if (!db) {
      console.error("DirectUploader: Firestore DB reference not found");
      throw new Error("Firestore DB reference not found");
    }
    
    console.log(`DirectUploader: Starting image compression and storage for room ${roomId}`);
    
    const imageUrls = [];
    const timestamp = Date.now();
    const maxChunkSize = 750 * 1024; // Safe size under Firestore's 1MB limit (~750KB)
    
    try {
      // Store metadata in a main document
      const mainDocRef = await addDoc(collection(db, 'imageStorage'), {
        roomId: roomId,
        timestamp: timestamp,
        totalImages: selectedImages.length,
        createdAt: serverTimestamp(),
        imageNames: selectedImages.map(img => img.name || 'unnamed_image')
      });
      
      console.log(`DirectUploader: Created main document with ID ${mainDocRef.id}`);
      
      // Process each image
      for (let i = 0; i < selectedImages.length; i++) {
        try {
          const image = selectedImages[i];
          console.log(`DirectUploader: Processing image ${i+1}/${selectedImages.length}`);
          
          // First attempt: Compress the image to a smaller size
          const compressedDataUrl = await this.compressImage(image.dataUrl, 800); // Max width 800px
          
          // Create a compressed thumbnail version
          const thumbnailDataUrl = await this.compressImage(image.dataUrl, 200); // Small thumbnail
          
          // Store thumbnail separately - should be small enough for one document
          const thumbnailDocRef = await addDoc(collection(db, 'imageData'), {
            mainDocId: mainDocRef.id,
            imageIndex: i,
            fileName: `thumbnail_${image.name || `image_${i}`}`,
            contentType: 'image/jpeg',
            isThumb: true,
            base64Data: thumbnailDataUrl,
            timestamp: timestamp,
            roomId: roomId,
            createdAt: serverTimestamp()
          });
          
          // For the main image, we need to check if it's still too large
          let mainImageUrl;
          
          if (this.getBase64Size(compressedDataUrl) <= maxChunkSize) {
            // If small enough after compression, store in one document
            const imageDocRef = await addDoc(collection(db, 'imageData'), {
              mainDocId: mainDocRef.id,
              imageIndex: i,
              fileName: image.name || `image_${i}.jpg`,
              contentType: 'image/jpeg',
              base64Data: compressedDataUrl, 
              timestamp: timestamp,
              roomId: roomId,
              isChunked: false,
              createdAt: serverTimestamp()
            });
            
            mainImageUrl = compressedDataUrl;
            console.log(`DirectUploader: Stored compressed image ${i+1} as single document`);
          } else {
            // If still too large, we need to chunk it
            const chunks = this.chunkString(compressedDataUrl, maxChunkSize);
            console.log(`DirectUploader: Image too large, splitting into ${chunks.length} chunks`);
            
            // Create a parent document for this chunked image
            const chunkedImageRef = await addDoc(collection(db, 'imageData'), {
              mainDocId: mainDocRef.id,
              imageIndex: i,
              fileName: image.name || `image_${i}.jpg`,
              contentType: 'image/jpeg',
              timestamp: timestamp,
              roomId: roomId,
              isChunked: true,
              totalChunks: chunks.length,
              createdAt: serverTimestamp()
            });
            
            // Store each chunk in a separate document
            const chunkPromises = chunks.map(async (chunk, chunkIndex) => {
              return await addDoc(collection(db, 'imageChunks'), {
                imageId: chunkedImageRef.id,
                mainDocId: mainDocRef.id,
                chunkIndex: chunkIndex,
                totalChunks: chunks.length,
                data: chunk,
                timestamp: timestamp
              });
            });
            
            await Promise.all(chunkPromises);
            console.log(`DirectUploader: Successfully stored all ${chunks.length} chunks for image ${i+1}`);
            
            // For chunked images, we just use the thumbnail in the UI for now
            // Later we can implement a mechanism to reconstruct the full image if needed
            mainImageUrl = thumbnailDataUrl;
          }
          
          // Store the URLs (either direct base64 or chunked reference)
          imageUrls.push(mainImageUrl);
          console.log(`DirectUploader: Successfully processed image ${i+1}`);
        } catch (error) {
          console.error(`DirectUploader: Error processing image ${i}:`, error);
        }
      }
    } catch (error) {
      console.error('DirectUploader: Error in upload process:', error);
      throw error;
    }
    
    console.log(`DirectUploader: Completed storing ${imageUrls.length}/${selectedImages.length} images`);
    
    // Return the image URLs (these will be either data URLs or references)
    return imageUrls;
  }
  
  /**
   * Compress an image to reduce its size
   * @param {string} dataUrl - The original data URL
   * @param {number} maxWidth - Maximum width in pixels
   * @returns {Promise<string>} Compressed data URL
   */
  async compressImage(dataUrl, maxWidth) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
          
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          // Draw and compress
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Get as JPEG with reduced quality
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // 70% quality
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }
  
  /**
   * Get the size of a base64 string in bytes
   * @param {string} base64 - The base64 string
   * @returns {number} Size in bytes
   */
  getBase64Size(base64) {
    // Remove the data:image/jpeg;base64, part
    const base64String = base64.split(',')[1] || base64;
    // Calculate size (3/4 of the base64 string length)
    return Math.ceil(base64String.length * 0.75);
  }
  
  /**
   * Split a string into chunks of specified size
   * @param {string} str - The string to chunk
   * @param {number} size - Maximum chunk size in bytes
   * @returns {Array<string>} Array of chunks
   */
  chunkString(str, size) {
    const chunks = [];
    let index = 0;
    
    // For base64 data URLs, keep the prefix only in the first chunk
    let prefix = '';
    let mainStr = str;
    
    if (str.includes('base64,')) {
      const parts = str.split('base64,');
      prefix = parts[0] + 'base64,';
      mainStr = parts[1];
    }
    
    while (index < mainStr.length) {
      const chunk = mainStr.slice(index, index + size);
      if (index === 0 && prefix) {
        // Add prefix to first chunk only
        chunks.push(prefix + chunk);
      } else {
        chunks.push(chunk);
      }
      index += size;
    }
    
    return chunks;
  }
}
