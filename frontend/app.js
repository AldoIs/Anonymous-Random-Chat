// Anonymous Chat Frontend Application

class AnonymousChat {
    constructor() {
        this.ws = null;
        this.userAlias = '';
        this.partnerAlias = '';
        this.currentRoomId = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // DOM elements
        this.elements = {
            landing: document.getElementById('landing'),
            waiting: document.getElementById('waiting'),
            chatInterface: document.getElementById('chatInterface'),
            userAlias: document.getElementById('userAlias'),
            partnerAlias: document.getElementById('partnerAlias'),
            chatMessages: document.getElementById('chatMessages'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            waitingMessage: document.getElementById('waitingMessage')
        };
        
        this.init();
    }
    
    init() {
        this.connectWebSocket();
        this.setupEventListeners();
    }
    
    // Connect to WebSocket server
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('Connected to chat server');
                this.isConnected = true;
                this.reconnectAttempts = 0;
            };
            
            this.ws.onmessage = (event) => {
                this.handleServerMessage(JSON.parse(event.data));
            };
            
            this.ws.onclose = () => {
                console.log('Disconnected from chat server');
                this.isConnected = false;
                this.handleDisconnection();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showError('Connection error. Please refresh the page.');
            };
            
        } catch (error) {
            console.error('Failed to connect to WebSocket:', error);
            this.showError('Unable to connect to chat server');
        }
    }
    
    // Handle server messages
    handleServerMessage(data) {
        switch (data.type) {
            case 'alias':
                this.userAlias = data.alias;
                this.elements.userAlias.textContent = this.userAlias;
                break;
                
            case 'waiting':
                this.showWaiting(data.message);
                break;
                
            case 'matched':
                this.handleMatch(data);
                break;
                
            case 'message':
                this.displayMessage(data.alias, data.message, false);
                break;
                
            case 'partner_left':
                this.displaySystemMessage(data.message);
                this.disableChatInput();
                break;
                
            case 'error':
                this.showError(data.message);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    // Handle successful match
    handleMatch(data) {
        this.partnerAlias = data.partnerAlias;
        this.currentRoomId = data.roomId;
        this.elements.partnerAlias.textContent = this.partnerAlias;
        
        this.showChatInterface();
        this.enableChatInput();
        this.displaySystemMessage(`You are now connected with ${this.partnerAlias}`);
    }
    
    // Show landing page
    showLanding() {
        this.hideAll();
        this.elements.landing.classList.remove('hidden');
        this.elements.landing.classList.add('fade-in');
    }
    
    // Show waiting screen
    showWaiting(message = 'Looking for someone to chat with...') {
        this.hideAll();
        this.elements.waiting.classList.remove('hidden');
        this.elements.waiting.classList.add('fade-in');
        this.elements.waitingMessage.textContent = message;
    }
    
    // Show chat interface
    showChatInterface() {
        this.hideAll();
        this.elements.chatInterface.classList.remove('hidden');
        this.elements.chatInterface.classList.add('fade-in');
        this.elements.messageInput.focus();
    }
    
    // Hide all screens
    hideAll() {
        this.elements.landing.classList.add('hidden');
        this.elements.waiting.classList.add('hidden');
        this.elements.chatInterface.classList.add('hidden');
    }
    
    // Start chat - find a match
    startChat() {
        if (!this.isConnected) {
            this.showError('Not connected to server. Please refresh the page.');
            return;
        }
        
        this.sendToServer({ type: 'find_match' });
    }
    
    // Cancel search
    cancelSearch() {
        this.sendToServer({ type: 'end_chat' });
        this.showLanding();
    }
    
    // Send message to chat partner
    sendMessage() {
        const message = this.elements.messageInput.value.trim();
        
        if (!message || !this.isConnected || !this.currentRoomId) {
            return;
        }
        
        // Display message immediately for better UX
        this.displayMessage(this.userAlias, message, true);
        this.elements.messageInput.value = '';
        
        // Send to server
        this.sendToServer({ type: 'message', message: message });
    }
    
    // Move to next chat
    nextChat() {
        if (!this.isConnected) return;
        
        this.clearChatMessages();
        this.sendToServer({ type: 'next_chat' });
        this.disableChatInput();
    }
    
    // End current chat
    endChat() {
        if (!this.isConnected) return;
        
        this.clearChatMessages();
        this.sendToServer({ type: 'end_chat' });
        this.showLanding();
    }
    
    // Display message in chat
    displayMessage(alias, message, isOwn) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own' : ''}`;
        
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        
        if (!isOwn) {
            const messageInfo = document.createElement('div');
            messageInfo.className = 'message-info';
            messageInfo.textContent = alias;
            messageDiv.appendChild(messageInfo);
        }
        
        messageBubble.textContent = message;
        messageDiv.appendChild(messageBubble);
        
        this.elements.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    // Display system message
    displaySystemMessage(message) {
        const systemDiv = document.createElement('div');
        systemDiv.className = 'system-message';
        systemDiv.textContent = message;
        
        this.elements.chatMessages.appendChild(systemDiv);
        this.scrollToBottom();
    }
    
    // Clear chat messages
    clearChatMessages() {
        this.elements.chatMessages.innerHTML = '';
    }
    
    // Scroll to bottom of chat
    scrollToBottom() {
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }
    
    // Enable chat input
    enableChatInput() {
        this.elements.messageInput.disabled = false;
        this.elements.sendBtn.disabled = false;
        this.elements.messageInput.placeholder = 'Type a message...';
    }
    
    // Disable chat input
    disableChatInput() {
        this.elements.messageInput.disabled = true;
        this.elements.sendBtn.disabled = true;
        this.elements.messageInput.placeholder = 'Chat ended';
        this.currentRoomId = null;
    }
    
    // Show error message
    showError(message) {
        alert(message); // Simple error display - could be improved with toast notifications
    }
    
    // Send message to server
    sendToServer(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    
    // Handle disconnection
    handleDisconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
            
            console.log(`Attempting to reconnect in ${delay}ms...`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, delay);
        } else {
            this.showError('Unable to reconnect to server. Please refresh the page.');
            this.disableChatInput();
        }
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Handle Enter key in message input
        this.elements.messageInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.sendMessage();
            }
        });
        
        // Handle page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden
            } else {
                // Page is visible - focus input if in chat
                if (!this.elements.chatInterface.classList.contains('hidden')) {
                    this.elements.messageInput.focus();
                }
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.scrollToBottom();
        });
    }
}

// Global functions for HTML onclick handlers
let chatApp;

function startChat() {
    chatApp.startChat();
}

function cancelSearch() {
    chatApp.cancelSearch();
}

function sendMessage() {
    chatApp.sendMessage();
}

function nextChat() {
    chatApp.nextChat();
}

function endChat() {
    chatApp.endChat();
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Initialize chat application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    chatApp = new AnonymousChat();
    
    // Handle browser back button
    window.addEventListener('popstate', (event) => {
        if (chatApp.currentRoomId) {
            event.preventDefault();
            if (confirm('Are you sure you want to leave the chat?')) {
                chatApp.endChat();
            }
        }
    });
    
    // Handle page unload
    window.addEventListener('beforeunload', (event) => {
        if (chatApp.currentRoomId) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
});

// Handle connection status
window.addEventListener('online', () => {
    if (!chatApp.isConnected) {
        chatApp.connectWebSocket();
    }
});

window.addEventListener('offline', () => {
    chatApp.showError('You are offline. Some features may not work.');
});