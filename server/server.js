// server.js - Main server file for Socket.io chat application

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users and messages
const users = {};
const messages = [];
const typingUsers = {};
const phoneToSocket = {};
const socketToPhone = {};

// Private chat rooms (roomId -> { users: {socketId: username}, messages: [] })
const privateRooms = {};

// Store registered users (phone -> username)
const registeredUsers = {};
const USERS_FILE = path.join(__dirname, 'users.json');

// Load registered users from file
if (fs.existsSync(USERS_FILE)) {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    Object.assign(registeredUsers, JSON.parse(data));
  } catch (err) {
    console.error('Error loading users file:', err);
  }
}

// Save registered users to file
const saveUsers = () => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(registeredUsers, null, 2));
  } catch (err) {
    console.error('Error saving users file:', err);
  }
};

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user registration
  socket.on('register', (data) => {
    const { phone, username } = data;
    if (!phone || !username) {
      socket.emit('registration_error', 'Phone and username are required');
      return;
    }

    // Basic phone validation (simple check for digits and length)
    if (!/^\d{10,15}$/.test(phone.replace(/[\s\-\(\)\+]/g, ''))) {
      socket.emit('registration_error', 'Invalid phone number format');
      return;
    }

    if (registeredUsers[phone]) {
      socket.emit('registration_error', 'Phone number already registered');
      return;
    }

    registeredUsers[phone] = username;
    saveUsers();
    socket.emit('registration_success', { phone, username });
    console.log(`User registered: ${username} (${phone})`);
  });

  // Handle user login
  socket.on('login', (data) => {
    const { phone } = data;
    if (!phone) {
      socket.emit('login_error', 'Phone number is required');
      return;
    }

    const username = registeredUsers[phone];
    if (!username) {
      socket.emit('login_error', 'Phone number not registered');
      return;
    }

    // Store phone to socket mapping
    phoneToSocket[phone] = socket.id;
    socketToPhone[socket.id] = phone;

    socket.emit('login_success', { phone, username });
    console.log(`User logged in: ${username} (${phone})`);
  });

  // Handle user joining (after login)
  socket.on('user_join', (data) => {
    const username = data.username || data;
    users[socket.id] = { username, id: socket.id };
    io.emit('user_list', Object.values(users));
    io.emit('user_joined', { username, id: socket.id });
    console.log(`${username} joined the chat`);
  });

  // Handle chat messages
  socket.on('send_message', (messageData) => {
    const message = {
      ...messageData,
      id: Date.now(),
      sender: messageData.sender || users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      timestamp: new Date().toISOString(),
    };

    messages.push(message);

    // Limit stored messages to prevent memory issues
    if (messages.length > 100) {
      messages.shift();
    }

    io.emit('receive_message', message);
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    const { isTyping, username } = data;
    if (users[socket.id] || username) {
      const userName = users[socket.id]?.username || username;

      if (isTyping) {
        typingUsers[socket.id] = userName;
      } else {
        delete typingUsers[socket.id];
      }

      io.emit('typing_users', Object.values(typingUsers));
    }
  });

  // Handle private messages
  socket.on('private_message', ({ to, message }) => {
    const messageData = {
      id: Date.now(),
      sender: users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      message,
      timestamp: new Date().toISOString(),
      isPrivate: true,
    };

    socket.to(to).emit('private_message', messageData);
    socket.emit('private_message', messageData);
  });

  // Handle joining private chat
  socket.on('join_private_chat', ({ partnerPhone, username }) => {
    console.log(`Private chat request from ${username} to ${partnerPhone}`);
    const partnerUsername = registeredUsers[partnerPhone];
    if (!partnerUsername) {
      socket.emit('private_chat_error', 'User not found');
      return;
    }

    // Find current user's phone using socketToPhone mapping
    const currentPhone = socketToPhone[socket.id];
    console.log('Current phone from mapping:', currentPhone);
    if (!currentPhone) {
      socket.emit('private_chat_error', 'You must be logged in to join private chat');
      return;
    }

    if (partnerPhone === currentPhone) {
      socket.emit('private_chat_error', 'Cannot chat with yourself');
      return;
    }

    // Check if partner is online
    const partnerSocketId = phoneToSocket[partnerPhone];
    if (!partnerSocketId) {
      socket.emit('private_chat_error', 'User is not online');
      return;
    }

    const partnerSocket = io.sockets.sockets.get(partnerSocketId);
    if (!partnerSocket) {
      socket.emit('private_chat_error', 'User is not online');
      return;
    }

    // Create room ID (sorted phones to ensure consistency)
    const roomId = [currentPhone, partnerPhone].sort().join('_');

    // Leave any existing rooms for both users
    [socket, partnerSocket].forEach(sock => {
      Object.keys(privateRooms).forEach(room => {
        if (privateRooms[room].users[sock.id]) {
          sock.leave(room);
          delete privateRooms[room].users[sock.id];
          if (Object.keys(privateRooms[room].users).length === 0) {
            delete privateRooms[room];
          }
        }
      });
    });

    // Join or create room
    if (!privateRooms[roomId]) {
      privateRooms[roomId] = { users: {}, messages: [] };
    }
    privateRooms[roomId].users[socket.id] = username;
    privateRooms[roomId].users[partnerSocketId] = partnerUsername;
    socket.join(roomId);
    partnerSocket.join(roomId);

    // Emit to both users
    socket.emit('private_chat_joined', { partnerUsername, roomId });
    partnerSocket.emit('private_chat_joined', { partnerUsername: username, roomId });
    console.log(`${username} and ${partnerUsername} joined private chat`);
  });

  // Handle private chat messages
  socket.on('send_private_message', ({ message, sender }) => {
    const messageData = {
      id: Date.now(),
      sender: sender || users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      message,
      timestamp: new Date().toISOString(),
    };

    // Find the room this socket is in
    let roomId = null;
    for (const [id, room] of Object.entries(privateRooms)) {
      if (room.users[socket.id]) {
        roomId = id;
        break;
      }
    }

    if (roomId) {
      privateRooms[roomId].messages.push(messageData);
      io.to(roomId).emit('private_message', messageData);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (users[socket.id]) {
      const { username } = users[socket.id];
      io.emit('user_left', { username, id: socket.id });
      console.log(`${username} left the chat`);
    }
    
    delete users[socket.id];
    delete typingUsers[socket.id];
    
    io.emit('user_list', Object.values(users));
    io.emit('typing_users', Object.values(typingUsers));
  });
});

// API routes
app.get('/api/messages', (req, res) => {
  res.json(messages);
});

app.get('/api/users', (req, res) => {
  res.json(Object.values(users));
});

// Root route
app.get('/', (req, res) => {
  res.send('Socket.io Chat Server is running');
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io }; 