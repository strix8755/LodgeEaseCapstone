/**
 * Firebase Image Manager - Handles retrieving images stored in Firebase
 * either as direct base64 data or chunked data
 */

export class FirebaseImageManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Retrieve an image from Firestore, handling chunking if necessary
   * @param {string} imageId - The ID of the image document
   * @returns {Promise<string>} Full image data URL
   */
  async getImageById(imageId) {
    try {
      const { getDoc, doc, collection, query, where, orderBy, getDocs } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
      );

      // First get the image document
      const imageDoc = await getDoc(doc(this.db, 'imageData', imageId));
      if (!imageDoc.exists()) {
        throw new Error('Image not found');
      }

      const imageData = imageDoc.data();
      
      // If image is not chunked, return the base64 data directly
      if (!imageData.isChunked) {
        return imageData.base64Data;
      }
      
      // Otherwise, we need to retrieve all chunks
      console.log(`Retrieving ${imageData.totalChunks} chunks for image ${imageId}`);
      
      const chunksQuery = query(
        collection(this.db, 'imageChunks'), 
        where('imageId', '==', imageId),
        orderBy('chunkIndex')
      );
      
      const chunksSnapshot = await getDocs(chunksQuery);
      
      // Sort chunks by index and concatenate
      const chunks = chunksSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      
      // Sort by chunk index
      chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      
      // Reconstruct the full image data
      let fullImageData = '';
      for (let i = 0; i < chunks.length; i++) {
        // Add the data prefix to the first chunk if it doesn't already have it
        if (i === 0 && !chunks[i].data.includes('data:image')) {
          fullImageData = 'data:image/jpeg;base64,' + chunks[i].data;
        } else {
          fullImageData += chunks[i].data;
        }
      }
      
      return fullImageData;
      
    } catch (error) {
      console.error('Error retrieving image:', error);
      return null;
    }
  }
  
  /**
   * Get all images for a lodge
   * @param {string} lodgeId - The lodge ID
   * @returns {Promise<Array<string>>} Array of image URLs
   */
  async getLodgeImages(lodgeId) {
    try {
      const { collection, query, where, getDocs } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
      );
      
      const imagesQuery = query(
        collection(this.db, 'imageData'),
        where('lodgeId', '==', lodgeId)
      );
      
      const imagesSnapshot = await getDocs(imagesQuery);
      
      // Extract the image data with thumbnails
      const images = [];
      
      for (const doc of imagesSnapshot.docs) {
        const data = doc.data();
        
        // If it's a thumbnail or direct image, add it
        if (data.base64Data && (!data.isChunked || data.isThumb)) {
          images.push({
            id: doc.id,
            url: data.base64Data,
            isThumb: data.isThumb || false
          });
        }
        // For chunked images, we'll need to reconstruct them on demand
        else if (data.isChunked) {
          images.push({
            id: doc.id,
            isChunked: true,
            needsReconstruction: true
          });
        }
      }
      
      return images;
      
    } catch (error) {
      console.error('Error getting lodge images:', error);
      return [];
    }
  }
}
