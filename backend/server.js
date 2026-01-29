const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple rate limiting
const rateLimiter = new Map();
const RATE_LIMIT = 10; // messages per minute
const MESSAGE_INTERVAL = 60000; // 1 minute

// Basic word filter (configurable)
const BANNED_WORDS = ['spam', 'abuse', 'hate']; // Add more as needed

// Anonymous chat server
class AnonymousChatServer {
  constructor() {
    this.waitingUsers = []; // Users waiting for a match
    this.activeRooms = new Map(); // Active chat rooms
    this.userSessions = new Map(); // User session data
    
    // Create HTTP server for serving static files
    this.server = http.createServer((req, res) => {
      this.serveStaticFile(req, res);
    });
    
    // Create WebSocket server
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.setupWebSocketHandlers();
  }
  
  // Serve static frontend files
  serveStaticFile(req, res) {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, '..', 'frontend', filePath);
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.woff': 'application/font-woff',
      '.ttf': 'application/font-ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'application/font-otf',
      '.wasm': 'application/wasm'
    };
    
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>404 Not Found</h1>', 'utf-8');
        } else {
          res.writeHead(500);
          res.end('Server Error', 'utf-8');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }
  
  // Generate random anonymous alias
  generateAnonymousAlias() {
    const adjectives = ['Happy', 'Clever', 'Swift', 'Brave', 'Quiet', 'Bold', 'Kind', 'Wise'];
    const animals = ['Fox', 'Eagle', 'Wolf', 'Bear', 'Lion', 'Tiger', 'Owl', 'Hawk'];
    const numbers = Math.floor(Math.random() * 999) + 1;
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    
    return `${adjective}${animal}${numbers}`;
  }
  
  // Check message rate limit
  checkRateLimit(userId) {
    const now = Date.now();
    const userMessages = rateLimiter.get(userId) || [];
    
    // Remove old messages outside the time window
    const recentMessages = userMessages.filter(time => now - time < MESSAGE_INTERVAL);
    
    if (recentMessages.length >= RATE_LIMIT) {
      return false; // Rate limited
    }
    
    recentMessages.push(now);
    rateLimiter.set(userId, recentMessages);
    return true;
  }
  
  // Basic word filter
  filterMessage(message) {
    const lowerMessage = message.toLowerCase();
    for (const word of BANNED_WORDS) {
      if (lowerMessage.includes(word)) {
        return false; // Message contains banned word
      }
    }
    return true;
  }
  
  // Setup WebSocket event handlers
  setupWebSocketHandlers() {
    this.wss.on('connection', (ws) => {
      console.log('New user connected');
      
      const userId = this.generateUserId();
      const alias = this.generateAnonymousAlias();
      
      // Store user session
      this.userSessions.set(userId, {
        ws,
        alias,
        roomId: null,
        connectedAt: Date.now()
      });
      
      // Send user their alias
      ws.send(JSON.stringify({
        type: 'alias',
        alias: alias
      }));
      
      // Handle messages from client
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleUserMessage(userId, data);
        } catch (error) {
          console.error('Invalid message format:', error);
        }
      });
      
      // Handle disconnection
      ws.on('close', () => {
        this.handleUserDisconnection(userId);
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleUserDisconnection(userId);
      });
    });
  }
  
  // Generate unique user ID
  generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }
  
  // Handle user messages
  handleUserMessage(userId, data) {
    const session = this.userSessions.get(userId);
    if (!session) return;
    
    switch (data.type) {
      case 'find_match':
        this.findMatch(userId);
        break;
        
      case 'message':
        this.handleChatMessage(userId, data.message);
        break;
        
      case 'next_chat':
        this.leaveCurrentRoom(userId);
        this.findMatch(userId);
        break;
        
      case 'end_chat':
        this.leaveCurrentRoom(userId);
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  }
  
  // Find a match for user
  findMatch(userId) {
    const session = this.userSessions.get(userId);
    if (!session || session.roomId) return;
    
    // Check if there's a waiting user
    if (this.waitingUsers.length > 0) {
      const matchedUserId = this.waitingUsers.shift();
      this.createRoom(userId, matchedUserId);
    } else {
      // Add to waiting list
      this.waitingUsers.push(userId);
      session.ws.send(JSON.stringify({
        type: 'waiting',
        message: 'Looking for someone to chat with...'
      }));
    }
  }
  
  // Create a chat room between two users
  createRoom(user1Id, user2Id) {
    const roomId = this.generateRoomId();
    const session1 = this.userSessions.get(user1Id);
    const session2 = this.userSessions.get(user2Id);
    
    if (!session1 || !session2) return;
    
    // Create room
    this.activeRooms.set(roomId, {
      users: [user1Id, user2Id],
      createdAt: Date.now()
    });
    
    // Update user sessions
    session1.roomId = roomId;
    session2.roomId = roomId;
    
    // Notify both users that they're matched
    const matchMessage = {
      type: 'matched',
      roomId: roomId,
      partnerAlias: session2.alias
    };
    
    session1.ws.send(JSON.stringify(matchMessage));
    
    session2.ws.send(JSON.stringify({
      ...matchMessage,
      partnerAlias: session1.alias
    }));
    
    console.log(`Room created: ${roomId} between ${session1.alias} and ${session2.alias}`);
  }
  
  // Generate room ID
  generateRoomId() {
    return 'room_' + Math.random().toString(36).substr(2, 9);
  }
  
  // Handle chat messages
  handleChatMessage(userId, message) {
    const session = this.userSessions.get(userId);
    if (!session || !session.roomId) return;
    
    // Rate limiting check
    if (!this.checkRateLimit(userId)) {
      session.ws.send(JSON.stringify({
        type: 'error',
        message: 'Rate limit exceeded. Please wait before sending more messages.'
      }));
      return;
    }
    
    // Word filter check
    if (!this.filterMessage(message)) {
      session.ws.send(JSON.stringify({
        type: 'error',
        message: 'Message contains inappropriate content.'
      }));
      return;
    }
    
    const room = this.activeRooms.get(session.roomId);
    if (!room) return;
    
    // Send message to the other user in the room
    room.users.forEach(otherUserId => {
      if (otherUserId !== userId) {
        const otherSession = this.userSessions.get(otherUserId);
        if (otherSession && otherSession.ws.readyState === WebSocket.OPEN) {
          otherSession.ws.send(JSON.stringify({
            type: 'message',
            alias: session.alias,
            message: message,
            timestamp: Date.now()
          }));
        }
      }
    });
  }
  
  // Leave current room
  leaveCurrentRoom(userId) {
    const session = this.userSessions.get(userId);
    if (!session || !session.roomId) return;
    
    const room = this.activeRooms.get(session.roomId);
    if (room) {
      // Notify the other user
      room.users.forEach(otherUserId => {
        if (otherUserId !== userId) {
          const otherSession = this.userSessions.get(otherUserId);
          if (otherSession && otherSession.ws.readyState === WebSocket.OPEN) {
            otherSession.ws.send(JSON.stringify({
              type: 'partner_left',
              message: 'Your chat partner has left the conversation.'
            }));
          }
          otherSession.roomId = null;
        }
      });
      
      // Remove room
      this.activeRooms.delete(session.roomId);
      console.log(`Room deleted: ${session.roomId}`);
    }
    
    session.roomId = null;
  }
  
  // Handle user disconnection
  handleUserDisconnection(userId) {
    const session = this.userSessions.get(userId);
    if (!session) return;
    
    console.log(`User disconnected: ${session.alias}`);
    
    // Remove from waiting list
    const waitingIndex = this.waitingUsers.indexOf(userId);
    if (waitingIndex > -1) {
      this.waitingUsers.splice(waitingIndex, 1);
    }
    
    // Leave current room
    this.leaveCurrentRoom(userId);
    
    // Clean up session
    this.userSessions.delete(userId);
    rateLimiter.delete(userId);
  }
  
  // Start the server
  start(port = 3000) {
    this.server.listen(port, () => {
      console.log(`Anonymous chat server running on http://localhost:${port}`);
      console.log('WebSocket server ready for connections');
    });
  }
}

// Start the server
const chatServer = new AnonymousChatServer();
chatServer.start(3001);