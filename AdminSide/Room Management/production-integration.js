// Function to enhance Vue with production capabilities
export function enhanceVueWithProduction(vueApp) {
    if (!vueApp) return;
    
    // Add a compatibility function to ensure Vue's $set works correctly
    if (!vueApp.$set) {
        vueApp.$set = function(obj, key, value) {
            if (Array.isArray(obj)) {
                obj.splice(key, 1, value);
                return value;
            }
            obj[key] = value;
            return value;
        };
    }
    
    // Override the uploadImages method with a more robust version
    const originalUploadImages = vueApp.uploadImages;
    
    vueApp.uploadImages = async function(roomId) {
        console.log("Using enhanced upload method for production");
        
        try {
            // Import Firebase storage directly
            const { getStorage, ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
            const storage = getStorage();
            
            const imageUrls = [];
            const timestamp = new Date().getTime();
            
            // Add random suffix to avoid collisions and CORS caching issues
            const uniqueFolderName = `rooms/${roomId}_${timestamp}_${Math.floor(Math.random() * 1000000)}`;
            
            for (let i = 0; i < this.selectedImages.length; i++) {
                const image = this.selectedImages[i];
                
                try {
                    // Update progress
                    this.$set(this.uploadProgress, i, 10);
                    
                    // Get the File object directly
                    const file = image.file;
                    
                    // Generate a unique name with fewer special characters
                    const safeFileName = `image_${i}_${timestamp}.jpg`;
                    
                    console.log(`Uploading image to ${uniqueFolderName}/${safeFileName}`);
                    
                    // Create reference
                    const storageRef = ref(storage, `${uniqueFolderName}/${safeFileName}`);
                    
                    // Create metadata with proper CORS headers
                    const metadata = {
                        contentType: file.type || 'image/jpeg',
                        customMetadata: {
                            'originalName': file.name,
                            'uploadTime': new Date().toString(),
                            'origin': window.location.origin
                        }
                    };
                    
                    // Update progress
                    this.$set(this.uploadProgress, i, 30);
                    
                    // Convert File to Blob using data URLs to get around CORS
                    const response = await fetch(image.url);
                    const blob = await response.blob();
                    
                    this.$set(this.uploadProgress, i, 50);
                    
                    // Upload the blob object (bypasses CORS)
                    const snapshot = await uploadBytes(storageRef, blob, metadata);
                    this.$set(this.uploadProgress, i, 80);
                    
                    // Get download URL
                    const url = await getDownloadURL(snapshot.ref);
                    imageUrls.push(url);
                    
                    // Update final progress
                    this.$set(this.uploadProgress, i, 100);
                    console.log(`Successfully uploaded: ${url}`);
                    
                } catch (err) {
                    console.error('Individual image upload error:', err);
                    this.$set(this.uploadProgress, i, 0);
                    
                    // Try one more approach with base64 encoding
                    try {
                        console.log("Attempting base64 upload fallback...");
                        const base64Data = image.dataUrl.split(',')[1];
                        const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                        
                        const safeFileName = `fallback_${i}_${timestamp}.jpg`;
                        const storageRef = ref(storage, `${uniqueFolderName}/${safeFileName}`);
                        
                        const snapshot = await uploadBytes(storageRef, byteArray, { 
                            contentType: 'image/jpeg' 
                        });
                        
                        const url = await getDownloadURL(snapshot.ref);
                        imageUrls.push(url);
                        console.log("Base64 fallback successful:", url);
                    } catch (fallbackErr) {
                        console.error("Base64 fallback also failed:", fallbackErr);
                        // If even the fallback fails, try to use the original method
                        if (imageUrls.length === 0) {
                            console.log("All approaches failed, trying original method");
                            return await originalUploadImages.call(this, roomId);
                        }
                    }
                }
            }
            
            return imageUrls.length > 0 ? imageUrls : await originalUploadImages.call(this, roomId);
            
        } catch (error) {
            console.error("Enhanced upload failed completely:", error);
            return await originalUploadImages.call(this, roomId);
        }
    };
    
    console.log("Vue enhanced with production capabilities");
    return vueApp;
}
