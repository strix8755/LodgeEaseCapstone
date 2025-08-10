/**
 * LodgeEase Admin Interface
 * This script provides the admin panel with abilities to interact with
 * the client-side lodge listings through a secure connection.
 */

// LodgeEase Admin Client Manager
class LodgeEaseAdminClient {
    constructor() {
        this.clientFrame = null;
        this.isConnected = false;
        this.pendingRequests = new Map();
        this.requestTimeout = 10000; // 10 seconds timeout
        this.requestIdCounter = 1;
        this.authToken = 'lodgeease-admin-token';
        
        // Set up message listener
        window.addEventListener('message', this.handleMessage.bind(this));
        
        console.log('LodgeEase Admin Client initialized');
    }

    /**
     * Connect to a client iframe
     * @param {HTMLIFrameElement} iframe - The iframe element containing the client page
     * @returns {Promise<boolean>} - Whether connection was successful
     */
    async connect(iframe) {
        if (!iframe || !iframe.contentWindow) {
            console.error('Invalid iframe provided');
            return false;
        }
        
        this.clientFrame = iframe;
        
        // First ping to check if client is ready
        try {
            const pingResponse = await this.sendRequest('PING');
            this.isConnected = true;
            console.log('Connected to client:', pingResponse.clientInfo);
            
            // Authenticate as admin
            await this.authenticate();
            
            return true;
        } catch (error) {
            console.error('Failed to connect to client:', error);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Authenticate with the client
     * @returns {Promise<boolean>} - Whether authentication was successful
     */
    async authenticate() {
        try {
            const authResponse = await this.sendRequest('AUTHENTICATE', {
                token: this.authToken
            });
            
            return authResponse.success;
        } catch (error) {
            console.error('Authentication failed:', error);
            return false;
        }
    }

    /**
     * Send a request to the client
     * @param {string} action - The action to perform
     * @param {object} data - Additional data for the request
     * @returns {Promise<object>} - The response from the client
     */
    sendRequest(action, data = {}) {
        return new Promise((resolve, reject) => {
            if (!this.clientFrame) {
                reject(new Error('Not connected to client'));
                return;
            }
            
            const requestId = `req_${this.requestIdCounter++}_${Date.now()}`;
            
            // Register request in pending requests
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(requestId);
                    reject(new Error(`Request ${action} timed out`));
                }, this.requestTimeout)
            });
            
            // Send message to client
            this.clientFrame.contentWindow.postMessage({
                type: 'LODGEEASE_ADMIN',
                action: action,
                requestId: requestId,
                ...data
            }, '*');
            
            console.log(`Sent ${action} request with ID ${requestId}`);
        });
    }

    /**
     * Handle incoming messages from the client
     * @param {MessageEvent} event - The message event
     */
    handleMessage(event) {
        const data = event.data;
        
        // Check if this is a message from our client
        if (!data || data.type !== 'LODGEEASE_CLIENT') {
            return;
        }
        
        console.log('Received message from client:', data.action);
        
        // Check if this is a response to a pending request
        if (data.requestId && this.pendingRequests.has(data.requestId)) {
            const request = this.pendingRequests.get(data.requestId);
            clearTimeout(request.timeout);
            this.pendingRequests.delete(data.requestId);
            
            // If there's an error, reject the promise
            if (data.action === 'ERROR' || (data.success === false && data.error)) {
                request.reject(new Error(data.error || 'Unknown client error'));
                return;
            }
            
            // Otherwise resolve with the response data
            request.resolve(data);
            return;
        }
        
        // Handle client ready messages
        if (data.type === 'CLIENT_READY') {
            console.log('Client announced its presence:', data);
            if (this.clientFrame && !this.isConnected) {
                this.connect(this.clientFrame).catch(console.error);
            }
        }
    }

    /**
     * Get all lodges from the client
     * @returns {Promise<Array>} - Array of lodges
     */
    async getAllLodges() {
        try {
            const response = await this.sendRequest('GET_LODGES');
            return response.lodges || [];
        } catch (error) {
            console.error('Error getting lodges:', error);
            return [];
        }
    }

    /**
     * Add a new lodge to the client
     * @param {object} lodge - The lodge to add
     * @returns {Promise<boolean>} - Whether the lodge was added successfully
     */
    async addLodge(lodge) {
        try {
            const response = await this.sendRequest('ADD_LODGE', { lodge });
            return response.success;
        } catch (error) {
            console.error('Error adding lodge:', error);
            return false;
        }
    }

    /**
     * Update an existing lodge on the client
     * @param {number|string} lodgeId - The ID of the lodge to update
     * @param {object} updatedData - The updated lodge data
     * @returns {Promise<boolean>} - Whether the lodge was updated successfully
     */
    async updateLodge(lodgeId, updatedData) {
        try {
            const response = await this.sendRequest('UPDATE_LODGE', { lodgeId, updatedData });
            return response.success;
        } catch (error) {
            console.error('Error updating lodge:', error);
            return false;
        }
    }

    /**
     * Remove a lodge from the client
     * @param {number|string} lodgeId - The ID of the lodge to remove
     * @returns {Promise<boolean>} - Whether the lodge was removed successfully
     */
    async removeLodge(lodgeId) {
        try {
            const response = await this.sendRequest('REMOVE_LODGE', { lodgeId });
            return response.success;
        } catch (error) {
            console.error('Error removing lodge:', error);
            return false;
        }
    }
}

// Create singleton instance for global access
window.lodgeEaseAdmin = new LodgeEaseAdminClient();

/**
 * Connect to an iframe containing the client page
 * @param {string|HTMLIFrameElement} iframe - The iframe element or its ID
 * @returns {Promise<boolean>} - Whether connection was successful
 */
window.connectToClientFrame = async function(iframe) {
    if (typeof iframe === 'string') {
        iframe = document.getElementById(iframe);
    }
    
    if (!iframe) {
        console.error('Iframe not found');
        return false;
    }
    
    return await window.lodgeEaseAdmin.connect(iframe);
};

/**
 * Add an iframe to the admin panel to connect to the client
 * @param {string} clientUrl - The URL of the client page
 * @returns {HTMLIFrameElement} - The created iframe
 */
window.createClientIframe = function(clientUrl = '../../ClientSide/Homepage/rooms.html') {
    // Create iframe container 
    const container = document.createElement('div');
    container.id = 'clientFrameContainer';
    container.style.cssText = 'display: none; position: fixed; bottom: 10px; right: 10px; width: 320px; height: 240px; border: 1px solid #ccc; background: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1); z-index: 1000; overflow: hidden;';
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'clientFrame';
    iframe.src = clientUrl;
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    container.appendChild(iframe);
    
    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; height: 30px; background: #f1f1f1; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; padding: 0 10px;';
    
    // Create title
    const title = document.createElement('span');
    title.textContent = 'Client Preview';
    title.style.cssText = 'font-size: 12px; font-weight: bold;';
    toolbar.appendChild(title);
    
    // Create buttons
    const btnContainer = document.createElement('div');
    
    // Toggle visibility button 
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '🔍';
    toggleBtn.title = 'Toggle visibility';
    toggleBtn.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 14px; margin-left: 5px;';
    toggleBtn.onclick = function() {
        const iframe = document.getElementById('clientFrame');
        if (iframe) {
            const container = iframe.parentElement;
            if (container.style.display === 'none') {
                container.style.display = 'block';
                toggleBtn.textContent = '🔍';
                toggleBtn.title = 'Hide preview';
            } else {
                container.style.display = 'none';
                toggleBtn.textContent = '🔎';
                toggleBtn.title = 'Show preview';
            }
        }
    };
    
    // Refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = '🔄';
    refreshBtn.title = 'Refresh client';
    refreshBtn.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 14px; margin-left: 5px;';
    refreshBtn.onclick = function() {
        const iframe = document.getElementById('clientFrame');
        if (iframe) {
            iframe.src = iframe.src;
        }
    };
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✖';
    closeBtn.title = 'Close preview';
    closeBtn.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 14px; margin-left: 5px;';
    closeBtn.onclick = function() {
        const container = document.getElementById('clientFrameContainer');
        if (container) {
            container.remove();
        }
    };
    
    btnContainer.appendChild(toggleBtn);
    btnContainer.appendChild(refreshBtn);
    btnContainer.appendChild(closeBtn);
    toolbar.appendChild(btnContainer);
    
    container.appendChild(toolbar);
    
    // Add to document
    document.body.appendChild(container);
    
    // Auto connect after iframe loads
    iframe.onload = async function() {
        try {
            const connected = await window.lodgeEaseAdmin.connect(iframe);
            console.log('Auto-connect result:', connected ? 'Connected' : 'Failed');
        } catch (error) {
            console.error('Error connecting to client:', error);
        }
    };
    
    return iframe;
};

// When the DOM is loaded, create a button to initialize the client iframe
document.addEventListener('DOMContentLoaded', function() {
    const adminPanel = document.querySelector('.table-container, main, #app');
    
    if (adminPanel) {
        // Create connect button
        const connectBtn = document.createElement('button');
        connectBtn.innerHTML = '<i class="fas fa-plug"></i> Connect to Client Preview';
        connectBtn.className = 'btn primary-button mt-4';
        connectBtn.style.cssText = 'background-color: #3490dc; color: white; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; margin-top: 16px;';
        connectBtn.onclick = function() {
            window.createClientIframe();
        };
        
        // Add to page
        adminPanel.appendChild(connectBtn);
    }
});

// Export for module usage
export { LodgeEaseAdminClient };
