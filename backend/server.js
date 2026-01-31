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

// Static rooms configuration
const STATIC_ROOMS = [
  { id: 'room-general', name: 'General Chat', description: 'General conversation for everyone', maxUsers: 50 },
  { id: 'room-tech', name: 'Tech Talk', description: 'Technology and programming discussions', maxUsers: 50 },
  { id: 'room-random', name: 'Random Stuff', description: 'Random topics and casual chat', maxUsers: 50 }
];

// Anonymous chat server
class AnonymousChatServer {
  constructor() {
    this.waitingUsers = []; // Users waiting for a 1-to-1 match
    this.activeRooms = new Map(); // Active 1-to-1 chat rooms
    this.userSessions = new Map(); // User session data
    this.staticRooms = new Map(); // Static rooms with user lists
    
    // Create HTTP server for serving static files
    this.server = http.createServer((req, res) => {
      this.serveStaticFile(req, res);
    });
    
    // Create WebSocket server
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.setupWebSocketHandlers();
    this.initializeStaticRooms();
  }
  
  // Initialize static rooms
  initializeStaticRooms() {
    STATIC_ROOMS.forEach(room => {
      this.staticRooms.set(room.id, {
        ...room,
        users: [],
        createdAt: Date.now()
      });
    });
  }
  
  // Get user statistics for display
  getUserStats() {
    const activeChatters = Array.from(this.activeRooms.values()).reduce((total, room) => {
      return total + room.users.length;
    }, 0) + Array.from(this.staticRooms.values()).reduce((total, room) => {
      return total + room.users.length;
    }, 0);
    
    const waitingUsers = this.waitingUsers.length;
    
    return {
      activeChatters,
      waitingUsers,
      totalUsers: this.userSessions.size
    };
  }
  
  // Broadcast user stats to all connected users
  broadcastUserStats() {
    const stats = this.getUserStats();
    const message = JSON.stringify({
      type: 'user_stats',
      ...stats
    });
    
    this.userSessions.forEach(session => {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(message);
      }
    });
  }
  
  // Get static rooms info with user counts
  getStaticRoomsInfo() {
    return Array.from(this.staticRooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      description: room.description,
      currentUsers: room.users.length,
      maxUsers: room.maxUsers
    }));
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
      
      // Send user their alias and initial stats
      ws.send(JSON.stringify({
        type: 'alias',
        alias: alias
      }));
      
      // Send initial user stats
      ws.send(JSON.stringify({
        type: 'user_stats',
        ...this.getUserStats()
      }));
      
      // Send static rooms info
      ws.send(JSON.stringify({
        type: 'static_rooms',
        rooms: this.getStaticRoomsInfo()
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
        
      case 'join_static_room':
        this.joinStaticRoom(userId, data.roomId);
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
        
      case 'leave_static_room':
        this.leaveStaticRoom(userId);
        break;
        
      case 'get_stats':
        this.sendUserStats(userId);
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
    session1.roomType = 'private';
    session2.roomId = roomId;
    session2.roomType = 'private';
    
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
    
    // Update stats
    this.broadcastUserStats();
    
    console.log(`Room created: ${roomId} between ${session1.alias} and ${session2.alias}`);
  }
  
  // Generate room ID
  generateRoomId() {
    return 'room_' + Math.random().toString(36).substr(2, 9);
  }
  
  // Join static room
  joinStaticRoom(userId, roomId) {
    const session = this.userSessions.get(userId);
    if (!session) return;
    
    const room = this.staticRooms.get(roomId);
    if (!room) {
      session.ws.send(JSON.stringify({
        type: 'error',
        message: 'Room not found'
      }));
      return;
    }
    
    if (room.users.length >= room.maxUsers) {
      session.ws.send(JSON.stringify({
        type: 'error',
        message: 'Room is full'
      }));
      return;
    }
    
    // Leave current room if any
    this.leaveCurrentRoom(userId);
    this.leaveStaticRoom(userId);
    
    // Join static room
    session.roomId = roomId;
    session.roomType = 'static';
    room.users.push(userId);
    
    // Notify user they joined
    session.ws.send(JSON.stringify({
      type: 'joined_static_room',
      roomId: roomId,
      roomName: room.name,
      roomUsers: room.users.length
    }));
    
    // Notify other users in room
    this.broadcastToStaticRoom(roomId, {
      type: 'user_joined',
      alias: session.alias,
      roomUsers: room.users.length
    }, userId);
    
    // Update stats
    this.broadcastUserStats();
    
    console.log(`${session.alias} joined static room: ${room.name}`);
  }
  
  // Leave static room
  leaveStaticRoom(userId) {
    const session = this.userSessions.get(userId);
    if (!session || !session.roomId || session.roomType !== 'static') return;
    
    const room = this.staticRooms.get(session.roomId);
    if (!room) return;
    
    // Remove user from room
    room.users = room.users.filter(id => id !== userId);
    
    // Notify other users
    this.broadcastToStaticRoom(session.roomId, {
      type: 'user_left',
      alias: session.alias,
      roomUsers: room.users.length
    }, userId);
    
    // Clear session room info
    session.roomId = null;
    session.roomType = null;
    
    // Update stats
    this.broadcastUserStats();
    
    console.log(`${session.alias} left static room: ${room.name}`);
  }
  
  // Broadcast message to static room
  broadcastToStaticRoom(roomId, message, excludeUserId = null) {
    const room = this.staticRooms.get(roomId);
    if (!room) return;
    
    room.users.forEach(userId => {
      if (userId !== excludeUserId) {
        const session = this.userSessions.get(userId);
        if (session && session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify(message));
        }
      }
    });
  }
  
  // Send user stats to specific user
  sendUserStats(userId) {
    const session = this.userSessions.get(userId);
    if (!session) return;
    
    session.ws.send(JSON.stringify({
      type: 'user_stats',
      ...this.getUserStats()
    }));
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
    
    const messageData = {
      type: 'message',
      alias: session.alias,
      message: message,
      timestamp: Date.now()
    };
    
    // Handle 1-to-1 room
    if (session.roomType === 'private' || !session.roomType) {
      const room = this.activeRooms.get(session.roomId);
      if (!room) return;
      
      room.users.forEach(otherUserId => {
        if (otherUserId !== userId) {
          const otherSession = this.userSessions.get(otherUserId);
          if (otherSession && otherSession.ws.readyState === WebSocket.OPEN) {
            otherSession.ws.send(JSON.stringify(messageData));
          }
        }
      });
    }
    // Handle static room
    else if (session.roomType === 'static') {
      this.broadcastToStaticRoom(session.roomId, messageData, userId);
    }
  }
  
  // Leave current room
  leaveCurrentRoom(userId) {
    const session = this.userSessions.get(userId);
    if (!session || !session.roomId) return;
    
    // Handle 1-to-1 room
    if (session.roomType === 'private' || !session.roomType) {
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
    }
    
    session.roomId = null;
    session.roomType = null;
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
    this.leaveStaticRoom(userId);
    
    // Clean up session
    this.userSessions.delete(userId);
    rateLimiter.delete(userId);
    
    // Update stats
    this.broadcastUserStats();
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
chatServer.start(3002);