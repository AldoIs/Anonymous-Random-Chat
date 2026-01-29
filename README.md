# Anonymous Random Chat (MVP)

A minimal, functional anonymous random chat prototype that connects two random users for real-time conversations without requiring accounts or storing personal data.

## Features

- ✅ Anonymous chat with randomly generated aliases
- ✅ Real-time messaging via WebSocket
- ✅ Automatic matchmaking between waiting users
- ✅ "Next Chat" and "End Chat" functionality
- ✅ Mobile and desktop responsive design
- ✅ Basic safety features (rate limiting + word filter)
- ✅ No database persistence (memory-only)
- ✅ Clean, minimal UI

## Architecture

### Backend (Node.js + WebSocket)
- **Matchmaking System**: Queues waiting users and pairs them automatically
- **Room Management**: Creates temporary chat rooms that exist in memory only
- **Rate Limiting**: 10 messages per minute per user
- **Word Filter**: Basic content filtering (configurable)
- **Anonymous Aliases**: Randomly generated names like "HappyFox123"

### Frontend (Vanilla HTML/CSS/JavaScript)
- **Three States**: Landing → Waiting → Chat
- **Real-time Updates**: Instant message delivery and status changes
- **Responsive Design**: Works on desktop and mobile
- **Clean UX**: Smooth transitions and intuitive controls

## How It Works

### Anonymity & Privacy
1. **No Registration**: Users click "Start Chat" and immediately get a random alias
2. **No Personal Data**: No names, emails, or persistent identifiers stored
3. **Memory Only**: Messages exist only in RAM during active chat
4. **Auto-Destruct**: Chat rooms are destroyed when either user leaves

### Matching Process
1. User clicks "Start Chat" → enters waiting pool
2. Server checks for another waiting user
3. If found: creates room, connects both users
4. If not found: user waits until someone else joins

### Chat Lifecycle
1. **Start**: Users are matched and can exchange messages
2. **Next Chat**: Current chat ends, user returns to waiting pool
3. **End Chat**: Chat ends, user returns to landing page
4. **Disconnect**: Room destroyed, messages lost forever

## Project Structure

```
Caso2/
├── backend/
│   ├── package.json          # Node.js dependencies
│   └── server.js             # WebSocket server + chat logic
├── frontend/
│   ├── index.html            # Main HTML file
│   ├── style.css             # Responsive styling
│   └── app.js                # Frontend JavaScript logic
└── README.md                 # This file
```

## Setup & Running

### Prerequisites
- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Start the Server**
   ```bash
   cd backend
   npm start
   ```
   The server will start on `http://localhost:3000`

3. **Open the Application**
   - Open your web browser
   - Navigate to `http://localhost:3000`
   - Open multiple browser tabs/windows to test multi-user chat

### Testing the Chat

1. **Single User Test**: Open one tab → you'll see "Looking for someone to chat with..."
2. **Multi-User Test**: Open two tabs → both users will be matched automatically
3. **Mobile Test**: Use browser developer tools to test mobile responsive design

## Configuration

### Safety Features (backend/server.js)

**Rate Limiting:**
```javascript
const RATE_LIMIT = 10; // messages per minute
const MESSAGE_INTERVAL = 60000; // 1 minute
```

**Word Filter:**
```javascript
const BANNED_WORDS = ['spam', 'abuse', 'hate']; // Add more as needed
```

**Anonymous Alias Generation:**
```javascript
const adjectives = ['Happy', 'Clever', 'Swift', 'Brave', 'Quiet', 'Bold', 'Kind', 'Wise'];
const animals = ['Fox', 'Eagle', 'Wolf', 'Bear', 'Lion', 'Tiger', 'Owl', 'Hawk'];
```

## Technical Notes

### WebSocket Messages

**Client → Server:**
- `find_match`: Enter waiting pool
- `message`: Send chat message
- `next_chat`: Leave current room and find new match
- `end_chat`: Leave current room and return to landing

**Server → Client:**
- `alias`: User's anonymous name
- `waiting`: Search status updates
- `matched`: Successful match with partner info
- `message`: Incoming chat message
- `partner_left`: Partner disconnected
- `error`: System errors (rate limit, filter, etc.)

### Memory Management

- User sessions stored in Map: `userSessions`
- Active rooms stored in Map: `activeRooms`
- Rate limits stored in Map: `rateLimiter`
- All data cleared on user disconnect

### Security Considerations

- No IP addresses exposed between users
- No message persistence
- Automatic room cleanup on disconnect
- Basic rate limiting prevents spam
- Configurable word filtering

## Limitations (MVP)

- No message history
- No file/image sharing
- No video/voice calls
- No user reporting system
- No advanced moderation
- Single server instance only
- No load balancing

## Development Notes

The code is intentionally simple and readable:

- **No frameworks** - Pure vanilla web technologies
- **Clear separation** - Frontend and backend are distinct
- **Inline documentation** - Comments explain key decisions
- **Easy to extend** - Modular structure for future features

## Future Improvements

- Add user reporting system
- Implement reconnect logic
- Add typing indicators
- Include message read receipts
- Add connection quality indicators
- Implement room-based themes
- Add emoji support
- Create admin dashboard for monitoring

## License

MIT License - Feel free to use, modify, and distribute.

---

**Note**: This is a prototype MVP designed for testing interaction quality, not a production-ready system. For production use, additional security, moderation, and infrastructure would be required.