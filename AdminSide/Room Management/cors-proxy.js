// This is a client-side CORS proxy for development
export class CorsProxy {
    constructor() {
        this.proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        // You can use other public CORS proxies like:
        // - https://api.allorigins.win/raw?url=
        // - https://corsproxy.io/?
        
        this.isEnabled = window.location.hostname === '127.0.0.1' || 
                          window.location.hostname === 'localhost';
    }
    
    // Method to upload an image to Firebase Storage using a CORS proxy
    async uploadImageWithProxy(storageRef, file, metadata) {
        if (!this.isEnabled) {
            throw new Error("CORS proxy is only available in development environment");
        }
        
        // Convert file to base64
        const base64 = await this.fileToBase64(file);
        
        // Create form data for the proxy
        const formData = new FormData();
        formData.append('file', file);
        formData.append('metadata', JSON.stringify(metadata));
        formData.append('path', storageRef.fullPath);
        
        // Use a public CORS proxy for this request
        const response = await fetch(`${this.proxyUrl}https://firebasestorage.googleapis.com/v0/b/lms-app-2b903.appspot.com/o?name=${encodeURIComponent(storageRef.fullPath)}`, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Proxy upload failed with status: ${response.status}`);
        }
        
        const result = await response.json();
        return result.downloadTokens 
            ? `https://firebasestorage.googleapis.com/v0/b/lms-app-2b903.appspot.com/o/${encodeURIComponent(storageRef.fullPath)}?alt=media&token=${result.downloadTokens}`
            : null;
    }
    
    // Helper method to convert a file to base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
}
