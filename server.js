const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Almacenar salas de juego
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  // Crear sala
  socket.on('createRoom', (data) => {
    const { playerName, roomName } = data;

    if (rooms.has(roomName)) {
      socket.emit('roomError', 'Ya existe una sala con ese nombre');
      return;
    }

    const room = {
      id: roomName,
      players: [{
        id: socket.id,
        name: playerName,
        number: 1
      }],
      gameState: null,
      created: Date.now()
    };

    rooms.set(roomName, room);
    socket.join(roomName);

    socket.emit('roomCreated', {
      roomName,
      playerNumber: 1
    });

    console.log(`Sala creada: ${roomName} por ${playerName}`);
  });

  // Unirse a sala
  socket.on('joinRoom', (data) => {
    const { playerName, roomName } = data;

    const room = rooms.get(roomName);
    if (!room) {
      socket.emit('roomError', 'La sala no existe');
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('roomError', 'La sala está llena');
      return;
    }

    room.players.push({
      id: socket.id,
      name: playerName,
      number: 2
    });

    socket.join(roomName);

    // Notificar a ambos jugadores
    io.to(roomName).emit('gameStart', {
      players: room.players,
      roomName
    });

    console.log(`${playerName} se unió a la sala: ${roomName}`);
  });

  // Actualizar estado del juego
  socket.on('updateGameState', (data) => {
    const { roomName, gameState } = data;
    const room = rooms.get(roomName);

    if (room) {
      room.gameState = gameState;
      // Enviar actualización a todos los jugadores en la sala excepto el emisor
      socket.to(roomName).emit('gameStateUpdate', gameState);
    }
  });

  // Mensaje de chat/juego
  socket.on('gameMessage', (data) => {
    const { roomName, message, type } = data;
    socket.to(roomName).emit('gameMessage', { message, type });
  });

  // Jugador listo
  socket.on('playerReady', (data) => {
    const { roomName, playerNumber } = data;
    socket.to(roomName).emit('opponentReady', playerNumber);
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);

    // Encontrar y limpiar salas donde estaba este jugador
    for (const [roomName, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);

        if (room.players.length === 0) {
          // Sala vacía, eliminarla
          rooms.delete(roomName);
          console.log(`Sala eliminada: ${roomName}`);
        } else {
          // Notificar al otro jugador
          io.to(roomName).emit('playerDisconnected', {
            disconnectedPlayer: playerIndex + 1
          });
        }
        break;
      }
    }
  });
});

// Limpiar salas inactivas cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [roomName, room] of rooms.entries()) {
    if (now - room.created > 30 * 60 * 1000) { // 30 minutos
      rooms.delete(roomName);
      io.to(roomName).emit('roomTimeout');
      console.log(`Sala expirada: ${roomName}`);
    }
  }
}, 5 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Accede a http://localhost:${PORT}`);
});