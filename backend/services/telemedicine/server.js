const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');

const port = process.env.PORT || 3004;

const server = http.createServer(app);

// Helper to get local IP address for cross-device testing
const getLocalIp = () => {
  const os = require('os');
  const networks = os.networkInterfaces();
  for (const name of Object.keys(networks)) {
    for (const net of networks[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
};

// Setup Socket.io Signaling
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT']
  }
});

io.on('connection', (socket) => {
  console.log(`[Telemedicine] Socket connected: ${socket.id}`);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    
    const clients = io.sockets.adapter.rooms.get(roomId);
    const numClients = clients ? clients.size : 0;
    console.log(`[Telemedicine] ${socket.id} joined ${roomId}. Members: ${numClients}`);
    
    // Broadcast presence so others know to start the 'Pulse'
    socket.to(roomId).emit('user_joined', { socketId: socket.id });
  });

  // Aggressive Pulse Relay
  socket.on('peer_ready', (data) => {
    socket.to(data.roomId).emit('peer_ready', { socketId: socket.id });
  });

  socket.on('webrtc_offer', (data) => {
    console.log(`[Telemedicine] Relay Offer from ${socket.id} in ${data.roomId}`);
    socket.to(data.roomId).emit('webrtc_offer', { sdp: data.sdp, sender: socket.id });
  });

  socket.on('webrtc_answer', (data) => {
    console.log(`[Telemedicine] Relay Answer from ${socket.id} in ${data.roomId}`);
    socket.to(data.roomId).emit('webrtc_answer', { sdp: data.sdp, sender: socket.id });
  });

  socket.on('ice_candidate', (data) => {
    socket.to(data.roomId).emit('ice_candidate', { candidate: data.candidate, sender: socket.id });
  });

  // Generic Relay for Metadata (Transcripts, Risk Alerts, Multi-med sync)
  socket.on('relay_message', (data) => {
    socket.to(data.roomId).emit('relay_message', data);
  });

  socket.on('disconnect', () => {
    console.log(`[Telemedicine] Disconnect: ${socket.id}`);
  });
});

// Presence Watchdog: Log actual occupancy of active rooms to terminal
setInterval(() => {
  const rooms = io.sockets.adapter.rooms;
  rooms.forEach((participants, roomId) => {
    if (roomId.length > 20) { // Only log appointment rooms, not individual socket rooms
      console.log(`[Monitor] Room ${roomId}: ${participants.size} online participants.`);
    }
  });
}, 5000);

server.listen(port, () => {
  const networkIp = getLocalIp();
  const host = process.env.SIGNALING_HOST || networkIp;
  console.log(`\n🚀 Telemedicine Signaling Service Online`);
  console.log(`📍 Local:   http://localhost:${port}`);
  console.log(`📡 Network: http://${host}:${port}\n`);
  if (host.startsWith('172.')) {
     console.warn('⚠️ WARNING: Using Docker Internal IP. For cross-device testing, set the SIGNALING_HOST environment variable to your Host Machine IP.');
  }
});
