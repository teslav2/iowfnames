const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Load words from words_tr.json
let wordList = [];
try {
  const wordsData = fs.readFileSync(path.join(__dirname, 'words_tr.json'), 'utf8');
  wordList = JSON.parse(wordsData);
} catch (error) {
  console.error("Kelime listesi yüklenemedi. Varsayılan kelimeler kullanılacak.", error);
  wordList = [
    "CİLT", "ALAY", "KIRBAÇ", "SEPET", "KAŞ", "TORPİL", "MELEK", "FENER", "TAŞ", "GÜN",
    "KEDİ", "REJİM", "PARTİ", "KAVAL", "YÜREK", "YEŞİL", "KULE", "ASKER", "KUVVET", "HAVA",
    "KAVURMA", "DOLU", "SIRA", "MASKARA", "HELİKOPTER", "ANAHTAR", "AMERİKA", "ALTIN", "DEMİR",
    "KARTAL", "ASLAN", "AT", "BALIK", "AĞAÇ", "ÇİÇEK", "DÜNYA", "GÜNEŞ", "AY", "DENİZ",
    "DAĞ", "KALE", "KİTAP", "SAAT", "TELEFON", "ARABA", "EKMEK", "ELMA", "HASTANE", "DOKTOR",
    "ÖĞRETMEN", "RÜZGAR", "YAĞMUR", "KAR", "ZAMAN", "SABAH", "KAPTAN", "KRAL", "MÜHENDİS",
    "MİMAR", "BİLGİSAYAR", "TELEFON", "KALEM", "KAPLAN", "KÜTÜPHANE", "OKUL", "ÖĞRENCİ"
  ];
}

// Room database in-memory
const rooms = {};

// Deletion timers for empty rooms
const roomCleanupTimers = {};

// Disconnection timers for players (reconnect grace period)
const playerDisconnectTimers = {};

// Helper: Generate random 6-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper: Shuffle array
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Helper: Dynamically count available character sheets in public directory
// Helper: Dynamically scan available character sheets and names from public/logos/characters
function scanCharacters() {
  try {
    const dir = path.join(__dirname, 'public', 'logos', 'characters');
    if (!fs.existsSync(dir)) return [];
    
    const files = fs.readdirSync(dir);
    const chars = [];
    
    // Sort files alphabetically to keep order consistent
    files.sort();
    
    files.forEach(file => {
      // Matches character[NAME]_[INDEX].(png|jpg|jpeg)
      const match = file.match(/^character([A-Za-z0-9İıŞşĞğÇçÖöÜü\-_]*?)_(\d+)\.(png|jpg|jpeg)$/i);
      if (match) {
        let extractedName = match[1].replace(/^[\-_]/, '').trim(); // Remove leading dash/underscore
        
        // Fallback names if name is empty (e.g. character_1.png)
        if (!extractedName) {
          const idx = parseInt(match[2]);
          const fallbacks = [
            "KOVBOY", "NESWİN", "ALİ", "MAMİ", "NURİBEY", 
            "KASIM", "DOBBY", "BLUSH", "ŞİNASİ", "TRIEL", 
            "BUSE", "ÇAĞRI", "FUFUSUU", "HASAN", "ASLAN"
          ];
          extractedName = fallbacks[(idx - 1) % fallbacks.length] || `KARAKTER ${idx}`;
        } else {
          // Clean up name: convert to uppercase Turkish-friendly
          extractedName = extractedName.toUpperCase();
        }
        
        chars.push({
          image: `/logos/characters/${file}`,
          name: extractedName,
          index: parseInt(match[2])
        });
      }
    });
    
    return chars;
  } catch (e) {
    console.error("scanCharacters error:", e);
    return [];
  }
}

// Helper: Generate Codenames Board (5x5, 25 cards)
function generateBoard() {
  const selectedWords = shuffle(wordList).slice(0, 25);
  const startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
  const secondTeam = startingTeam === 'red' ? 'blue' : 'red';
  
  const colors = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(secondTeam),
    ...Array(7).fill('neutral'),
    'assassin'
  ];
  
  const shuffledColors = shuffle(colors);
  
  // Scan all characters
  const availableChars = scanCharacters();
  console.log("[DEBUG] Scanned character files and names:", availableChars.map(c => `${c.name} (${c.image})`));
  
  return {
    startingTeam,
    cards: selectedWords.map((word, index) => {
      let charImage = `/logos/characters/character_1.png`;
      let charName = "KASIM";
      
      if (availableChars.length > 0) {
        // Pick character based on index modulo size
        const charData = availableChars[index % availableChars.length];
        charImage = charData.image;
        charName = charData.name;
      }
      
      return {
        word,
        color: shuffledColors[index], // red / blue / neutral / assassin
        revealed: false,
        stage: 0, // 0: closed, 1: character visible (word hidden), 2: word visible on top of character
        clickedBy: null,
        thinkingBy: [], // array of socket ids thinking on this card
        characterImage: charImage,
        characterName: charName
      };
    })
  };
}

// Game Action: Reset or Start Game state
function initGame(room) {
  const { startingTeam, cards } = generateBoard();
  
  room.gameState = {
    board: cards,
    startingTeam,
    currentTurn: {
      team: startingTeam,
      role: 'spymaster', // spymaster | agent
      clue: null         // { word, count, remainingGuesses }
    },
    scores: {
      red: startingTeam === 'red' ? 9 : 8,
      blue: startingTeam === 'blue' ? 9 : 8
    },
    teamNames: {
      red: room.teamNames ? room.teamNames.red : "KIRMIZI TAKIM",
      blue: room.teamNames ? room.teamNames.blue : "MAVİ TAKIM"
    },
    winner: null,
    log: []
  };

  room.gameStarted = true;
  room.gameEnded = false;
  
  const startingTeamName = startingTeam === 'red' ? room.gameState.teamNames.red : room.gameState.teamNames.blue;
  addLog(room, `Oyun başladı! İlk hamle sırası "${startingTeamName}" anlatıcısında.`);
}

function addLog(room, text) {
  const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (room.gameState) {
    room.gameState.log.push({ text, time });
    if (room.gameState.log.length > 50) {
      room.gameState.log.shift();
    }
  }
}

// Get clean room state for client consumption
function getRoomClientData(roomCode) {
  const room = rooms[roomCode];
  if (!room) return null;
  return {
    roomCode: room.roomCode,
    players: room.players,
    hostId: room.hostId,
    gameStarted: room.gameStarted,
    gameEnded: room.gameEnded,
    gameState: room.gameState,
    settings: room.settings,
    teamNames: room.teamNames || { red: "KIRMIZI TAKIM", blue: "MAVİ TAKIM" }
  };
}

// Active Timer Management
const activeCountdownTimers = {};
function startServerTimer(roomCode) {
  stopServerTimer(roomCode);
  const room = rooms[roomCode];
  if (!room || !room.gameState || room.gameState.winner) return;

  const duration = room.settings.turnDuration;
  if (duration === 'unlimited' || duration === 0) return; // Unlimited mode

  room.gameState.timerSecondsRemaining = duration;

  activeCountdownTimers[roomCode] = setInterval(() => {
    const r = rooms[roomCode];
    if (!r || !r.gameState || r.gameState.winner) {
      stopServerTimer(roomCode);
      return;
    }

    r.gameState.timerSecondsRemaining--;
    io.to(roomCode).emit('timerTick', { remaining: r.gameState.timerSecondsRemaining });

    if (r.gameState.timerSecondsRemaining <= 0) {
      stopServerTimer(roomCode);
      // Auto-pass turn
      switchTurn(r);
      addLog(r, `⏳ Süre dolduğu için tur sırası otomatik değişti.`);
      io.to(roomCode).emit('roomState', getRoomClientData(roomCode));
    }
  }, 1000);
}

function stopServerTimer(roomCode) {
  if (activeCountdownTimers[roomCode]) {
    clearInterval(activeCountdownTimers[roomCode]);
    delete activeCountdownTimers[roomCode];
  }
}

function switchTurn(room) {
  if (!room || !room.gameState) return;
  const turn = room.gameState.currentTurn;
  const nextTeam = turn.team === 'red' ? 'blue' : 'red';
  
  turn.team = nextTeam;
  turn.role = 'spymaster';
  turn.clue = null;
  
  // Clear all card thinking markers on turn change
  room.gameState.board.forEach(card => {
    card.thinkingBy = [];
  });

  const nextTeamName = nextTeam === 'red' ? room.gameState.teamNames.red : room.gameState.teamNames.blue;
  addLog(room, `Sıra "${nextTeamName}" anlatıcısına geçti.`);
  startServerTimer(room.roomCode);
}

// Socket Connection handling
io.on('connection', (socket) => {
  let currentRoomCode = null;
  let currentPlayerId = null;

  // Cleanup player disconnect timeouts
  function cancelPlayerDisconnectTimer(playerId) {
    if (playerDisconnectTimers[playerId]) {
      clearTimeout(playerDisconnectTimers[playerId]);
      delete playerDisconnectTimers[playerId];
    }
  }

  // Helper: check if player is host
  function isHost(room) {
    return room && room.hostId === socket.id;
  }

  // 1. Create Room
  socket.on('createRoom', ({ name, playerId }) => {
    try {
      const nameClean = name ? name.trim() : 'Bilinmeyen Oyuncu';
      const pidClean = playerId || `pid-${Math.random().toString(36).substr(2, 9)}`;
      const roomCode = generateRoomCode();
      
      rooms[roomCode] = {
        roomCode,
        players: [],
        gameStarted: false,
        gameEnded: false,
        hostId: socket.id,
        gameState: null,
        bannedNames: [],
        teamNames: { red: "KIRMIZI TAKIM", blue: "MAVİ TAKIM" },
        settings: {
          turnDuration: 90, // default 90 seconds
          maxPlayers: 'unlimited' // max players limit (4, 6, 8, 10, 20, unlimited)
        }
      };

      const playerInfo = {
        id: socket.id,
        playerId: pidClean,
        name: nameClean,
        team: 'spectator',
        role: 'agent',
        isHost: true,
        isBot: false,
        connected: true,
        emoji: null
      };

      rooms[roomCode].players.push(playerInfo);
      currentRoomCode = roomCode;
      currentPlayerId = pidClean;
      
      // Cancel cleanup timer if it exists
      if (roomCleanupTimers[roomCode]) {
        clearTimeout(roomCleanupTimers[roomCode]);
        delete roomCleanupTimers[roomCode];
      }

      socket.join(roomCode);
      socket.emit('roomCreated', { roomCode, player: playerInfo });
      io.to(roomCode).emit('roomState', getRoomClientData(roomCode));
      
      console.log(`Room created: ${roomCode} by host ${nameClean} (${pidClean})`);
    } catch (e) {
      console.error("createRoom error:", e);
    }
  });

  // 2. Join Room (Handles Reconnection and duplicate player prevention)
  socket.on('joinRoom', ({ roomCode, name, playerId }) => {
    try {
      const code = roomCode ? roomCode.toUpperCase().trim() : '';
      const nameClean = name ? name.trim() : 'Bilinmeyen Oyuncu';
      const pidClean = playerId || `pid-${Math.random().toString(36).substr(2, 9)}`;

      if (!rooms[code]) {
        return socket.emit('errorMsg', 'Oda bulunamadı. Lütfen oda kodunu kontrol edin.');
      }

      const room = rooms[code];

      // Check Ban
      if (room.bannedNames.includes(nameClean.toUpperCase())) {
        return socket.emit('errorMsg', 'Bu odadan yasaklandınız! Giriş yapamazsınız.');
      }

      // Check Max Players Limit (only if not a reconnecting player)
      const isReconnecting = room.players.find(p => p.playerId === pidClean);
      if (!isReconnecting && room.settings.maxPlayers !== 'unlimited') {
        const activePlayersCount = room.players.filter(p => !p.isBot).length;
        if (activePlayersCount >= parseInt(room.settings.maxPlayers)) {
          return socket.emit('errorMsg', `Oda maksimum oyuncu limitine (${room.settings.maxPlayers}) ulaştı.`);
        }
      }

      cancelPlayerDisconnectTimer(pidClean);

      let playerInfo;

      if (isReconnecting) {
        // Reconnection flow: bind existing player to new socket.id
        playerInfo = isReconnecting;
        playerInfo.id = socket.id; // Update socket ID
        playerInfo.connected = true;
        playerInfo.name = nameClean; // Sync name in case it changed
        if (playerInfo.isHost) {
          room.hostId = socket.id;
        }
        console.log(`Player reconnected: ${nameClean} in room ${code}`);
      } else {
        // Prevent duplicate names for new connections
        const duplicateName = room.players.find(p => p.name.toUpperCase() === nameClean.toUpperCase() && !p.isBot);
        if (duplicateName) {
          return socket.emit('errorMsg', 'Bu isimde başka bir oyuncu odada zaten mevcut.');
        }

        // New connection
        playerInfo = {
          id: socket.id,
          playerId: pidClean,
          name: nameClean,
          team: room.gameStarted ? 'spectator' : 'spectator', // new joins during game automatically spectator
          role: 'agent',
          isHost: false,
          isBot: false,
          connected: true,
          emoji: null
        };
        
        room.players.push(playerInfo);
        console.log(`Player joined: ${nameClean} in room ${code}`);
      }

      currentRoomCode = code;
      currentPlayerId = pidClean;

      // Cancel cleanup timer
      if (roomCleanupTimers[code]) {
        clearTimeout(roomCleanupTimers[code]);
        delete roomCleanupTimers[code];
      }

      socket.join(code);
      socket.emit('roomJoined', { roomCode: code, player: playerInfo });
      io.to(code).emit('roomState', getRoomClientData(code));
    } catch (e) {
      console.error("joinRoom error:", e);
    }
  });

  // 3. Select Team and Role (With Spymaster limits)
  socket.on('selectTeamRole', ({ team, role }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      // If game has started, players cannot change team/role unless they are spectating and reconnecting
      if (room.gameStarted && team !== 'spectator') {
        return socket.emit('errorMsg', 'Oyun başladıktan sonra takım/rol değiştiremezsiniz.');
      }

      // Max 1 spymaster per team validation
      if (role === 'spymaster' && (team === 'red' || team === 'blue')) {
        const existingSpymaster = room.players.find(p => p.team === team && p.role === 'spymaster' && p.id !== socket.id);
        if (existingSpymaster) {
          return socket.emit('errorMsg', `${team === 'red' ? 'Kırmızı' : 'Mavi'} takımın zaten bir anlatıcısı (Lider) var.`);
        }
      }

      player.team = team;
      player.role = role;

      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("selectTeamRole error:", e);
    }
  });

  // 4. Update Game Settings (Host Only)
  socket.on('updateSettings', ({ turnDuration, maxPlayers }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      if (!isHost(room)) return socket.emit('errorMsg', 'Ayarları sadece lider değiştirebilir.');

      if (turnDuration !== undefined) {
        room.settings.turnDuration = turnDuration === 'unlimited' ? 'unlimited' : parseInt(turnDuration);
      }
      if (maxPlayers !== undefined) {
        room.settings.maxPlayers = maxPlayers === 'unlimited' ? 'unlimited' : parseInt(maxPlayers);
      }

      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("updateSettings error:", e);
    }
  });

  // 5. Kick Player (Host Only)
  socket.on('kickPlayer', ({ playerId }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      if (!isHost(room)) return socket.emit('errorMsg', 'Oyuncuları sadece lider atabilir.');

      const targetIndex = room.players.findIndex(p => p.id === playerId);
      if (targetIndex !== -1) {
        const targetSocketId = room.players[targetIndex].id;
        const name = room.players[targetIndex].name;
        room.players.splice(targetIndex, 1);
        
        io.to(targetSocketId).emit('kickedOut');
        
        // Remove from socket channel
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) targetSocket.leave(currentRoomCode);

        addLog(room, `System: ${name} oda lideri tarafından odadan atıldı.`);
        io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
      }
    } catch (e) {
      console.error("kickPlayer error:", e);
    }
  });

  // 6. Ban Player (Host Only)
  socket.on('banPlayer', ({ playerId }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      if (!isHost(room)) return socket.emit('errorMsg', 'Oyuncuları sadece lider yasaklayabilir.');

      const targetIndex = room.players.findIndex(p => p.id === playerId);
      if (targetIndex !== -1) {
        const targetSocketId = room.players[targetIndex].id;
        const nameClean = room.players[targetIndex].name;
        
        room.bannedNames.push(nameClean.toUpperCase());
        room.players.splice(targetIndex, 1);
        
        io.to(targetSocketId).emit('bannedOut');
        
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) targetSocket.leave(currentRoomCode);

        addLog(room, `System: ${nameClean} lider tarafından odadan yasaklandı.`);
        io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
      }
    } catch (e) {
      console.error("banPlayer error:", e);
    }
  });

  // 7. Make Spectator (Host Only)
  socket.on('makeSpectator', ({ playerId }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      if (!isHost(room)) return socket.emit('errorMsg', 'Oyuncuları sadece lider izleyici yapabilir.');

      const target = room.players.find(p => p.id === playerId);
      if (target) {
        target.team = 'spectator';
        target.role = 'agent';
        io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
      }
    } catch (e) {
      console.error("makeSpectator error:", e);
    }
  });

  // 8. Shuffle Teams (Host Only)
  socket.on('shuffleTeams', () => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      if (!isHost(room)) return socket.emit('errorMsg', 'Takımları sadece lider karıştırabilir.');

      // Get all active human players who are not spectators
      let participants = room.players.filter(p => !p.isBot);
      participants = shuffle(participants);

      // Distribute evenly between red and blue, reset roles to agent
      participants.forEach((p, idx) => {
        p.team = (idx % 2 === 0) ? 'red' : 'blue';
        p.role = 'agent';
      });

      addLog(room, `Lider takımları karıştırarak dengeli bir şekilde dağıttı.`);
      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("shuffleTeams error:", e);
    }
  });

  // 9. Transfer Admin/Host (Host Only)
  socket.on('transferAdmin', ({ playerId }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      if (!isHost(room)) return socket.emit('errorMsg', 'Liderliği sadece lider devredebilir.');

      const target = room.players.find(p => p.id === playerId);
      if (target) {
        room.hostId = target.id;
        
        // Update tags
        room.players.forEach(p => {
          p.isHost = (p.id === room.hostId);
        });

        addLog(room, `Oda liderliği ${target.name} oyuncusuna devredildi.`);
        io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
      }
    } catch (e) {
      console.error("transferAdmin error:", e);
    }
  });

  // 10. Start Normal Game (Host Only, Validates Roles)
  socket.on('startGame', () => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      if (!isHost(room)) return socket.emit('errorMsg', 'Oyunu sadece lider başlatabilir.');

      // Check Start Conditions: At least 1 Red Lider and 1 Blue Lider
      const redSpymaster = room.players.find(p => p.team === 'red' && p.role === 'spymaster');
      const blueSpymaster = room.players.find(p => p.team === 'blue' && p.role === 'spymaster');

      if (!redSpymaster || !blueSpymaster) {
        return socket.emit('errorMsg', 'Oyuna başlamak için her iki takımda da en az 1 Lider olmalıdır!');
      }

      initGame(room);
      startServerTimer(currentRoomCode);
      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("startGame error:", e);
    }
  });

  // 11. Start Test Mode (Admin Only, Adds Dummy Bots to missing roles)
  socket.on('startTestMode', () => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      if (!isHost(room)) return socket.emit('errorMsg', 'Test modunu sadece lider başlatabilir.');

      // Clear existing dummy bots first to avoid clutter
      room.players = room.players.filter(p => !p.isBot);

      // Fill in missing slots with test bots
      const redSpymaster = room.players.find(p => p.team === 'red' && p.role === 'spymaster');
      const blueSpymaster = room.players.find(p => p.team === 'blue' && p.role === 'spymaster');
      const redAgent = room.players.find(p => p.team === 'red' && p.role === 'agent');
      const blueAgent = room.players.find(p => p.team === 'blue' && p.role === 'agent');

      if (!redSpymaster) {
        room.players.push({ id: 'bot-red-spymaster', playerId: 'bot-red-spymaster', name: 'Bot Anlatıcı K', team: 'red', role: 'spymaster', isHost: false, isBot: true, connected: true });
      }
      if (!redAgent) {
        room.players.push({ id: 'bot-red-agent', playerId: 'bot-red-agent', name: 'Bot Ekip K', team: 'red', role: 'agent', isHost: false, isBot: true, connected: true });
      }
      if (!blueSpymaster) {
        room.players.push({ id: 'bot-blue-spymaster', playerId: 'bot-blue-spymaster', name: 'Bot Anlatıcı M', team: 'blue', role: 'spymaster', isHost: false, isBot: true, connected: true });
      }
      if (!blueAgent) {
        room.players.push({ id: 'bot-blue-agent', playerId: 'bot-blue-agent', name: 'Bot Ekip M', team: 'blue', role: 'agent', isHost: false, isBot: true, connected: true });
      }

      initGame(room);
      startServerTimer(currentRoomCode);
      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("startTestMode error:", e);
    }
  });

  // 12. Submit Clue (Spymaster Only)
  socket.on('submitClue', ({ clueWord, clueCount }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      const gameState = room.gameState;
      if (!gameState || gameState.winner) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      const currentTurn = gameState.currentTurn;

      // Validate turn: must be player's team turn, role must be spymaster
      if (player.team !== currentTurn.team || player.role !== 'spymaster') {
        return socket.emit('errorMsg', 'Sıra sizde değil ya da Lider değilsiniz.');
      }

      if (currentTurn.role !== 'spymaster') {
        return socket.emit('errorMsg', 'İpucu zaten verilmiş. Ekibin tahmin yapması bekleniyor.');
      }

      // Set clue
      currentTurn.clue = {
        word: clueWord.toUpperCase().trim(),
        count: parseInt(clueCount),
        remainingGuesses: parseInt(clueCount) === 0 ? 25 : parseInt(clueCount) + 1
      };
      currentTurn.role = 'agent'; // Change phase to agents

      const teamName = player.team === 'red' ? gameState.teamNames.red : gameState.teamNames.blue;
      addLog(room, `${player.name} (${teamName} Anlatıcı) ipucu verdi: "${clueWord.toUpperCase()} ${clueCount}"`);
      
      startServerTimer(currentRoomCode); // Reset timer for agent guessing phase
      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("submitClue error:", e);
    }
  });

  // 13. Pass Turn (Agent Only)
  socket.on('endTurn', () => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      const gameState = room.gameState;
      if (!gameState || gameState.winner) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      const currentTurn = gameState.currentTurn;

      // Validate turn
      if (player.team !== currentTurn.team || player.role !== 'agent') {
        return socket.emit('errorMsg', 'Turu sadece sırası gelen takımın ekibi sonlandırabilir.');
      }

      addLog(room, `${player.name} sırasını savdı. Pas geçildi.`);
      switchTurn(room);
      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("endTurn error:", e);
    }
  });

  // 14. Card click: Toggle Thinking Marker (Agent Only)
  socket.on('toggleThinking', ({ cardIndex }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      const gameState = room.gameState;
      if (!gameState || gameState.winner) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player || player.role !== 'agent') return; // Only agents can think/mark cards

      const currentTurn = gameState.currentTurn;

      // Only active team agents during agent phase
      if (player.team !== currentTurn.team || currentTurn.role !== 'agent') return;

      const card = gameState.board[cardIndex];
      if (!card || card.revealed) return;

      const index = card.thinkingBy.indexOf(socket.id);
      if (index === -1) {
        card.thinkingBy.push(socket.id);
      } else {
        card.thinkingBy.splice(index, 1);
      }

      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("toggleThinking error:", e);
    }
  });

  // 15. Card click: Confirm Reveal (Agent Only, Two-Stage opening logic)
  socket.on('confirmReveal', ({ cardIndex }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      const gameState = room.gameState;
      if (!gameState || gameState.winner) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player || player.role !== 'agent') return; // Only agents can reveal cards

      const currentTurn = gameState.currentTurn;

      // Validate turn/phase
      if (player.team !== currentTurn.team || currentTurn.role !== 'agent') {
        return socket.emit('errorMsg', 'Sıra sizde değil veya ipucu aşaması tamamlanmadı.');
      }

      const card = gameState.board[cardIndex];
      if (!card || card.revealed) return;

      // Perform card reveal (Stage 1)
      card.revealed = true;
      card.stage = 1; // character visible, word hidden
      card.clickedBy = player.name;
      card.thinkingBy = []; // Clear thinkers

      const teamName = player.team === 'red' ? gameState.teamNames.red : gameState.teamNames.blue;

      // Log results and evaluate color matching
      let isCorrect = false;
      let cardResultText = '';

      if (card.color === 'red') cardResultText = 'Kırmızı Ekip 🔴';
      else if (card.color === 'blue') cardResultText = 'Mavi Ekip 🔵';
      else if (card.color === 'neutral') cardResultText = 'Masum Sivil ⚪';
      else if (card.color === 'assassin') cardResultText = 'Tetikçi/Suikastçı 💀';

      addLog(room, `${player.name} "${card.word}" kartını açtı. Sonuç: ${cardResultText}`);

      // Evaluate Codenames outcomes
      if (card.color === 'assassin') {
        const opposingTeam = currentTurn.team === 'red' ? 'blue' : 'red';
        gameState.winner = opposingTeam;
        const oppTeamName = opposingTeam === 'red' ? gameState.teamNames.red : gameState.teamNames.blue;
        addLog(room, `⚠️ TETİKÇİ KARTI AÇILDI! ${teamName} kaybetti. Kazanan: ${oppTeamName}!`);
        stopServerTimer(currentRoomCode);
      } else if (card.color === currentTurn.team) {
        // Correct guess
        gameState.scores[currentTurn.team]--;
        isCorrect = true;

        if (gameState.scores[currentTurn.team] === 0) {
          gameState.winner = currentTurn.team;
          addLog(room, `🎉 TEBRİKLER! ${teamName} tüm kelimeleri bularak kazandı!`);
          stopServerTimer(currentRoomCode);
        } else {
          currentTurn.clue.remainingGuesses--;
          if (currentTurn.clue.remainingGuesses <= 0) {
            switchTurn(room);
          } else {
            startServerTimer(currentRoomCode); // Reset timer for next guess
          }
        }
      } else if (card.color === 'neutral') {
        // Neutral sivil
        switchTurn(room);
      } else {
        // Opposing team card opened
        const opposingTeam = currentTurn.team === 'red' ? 'blue' : 'red';
        gameState.scores[opposingTeam]--;
        
        if (gameState.scores[opposingTeam] === 0) {
          gameState.winner = opposingTeam;
          const oppTeamName = opposingTeam === 'red' ? gameState.teamNames.red : gameState.teamNames.blue;
          addLog(room, `🎉 ${oppTeamName} tüm kelimeleri açıldığı için kazandı!`);
          stopServerTimer(currentRoomCode);
        } else {
          switchTurn(room);
        }
      }

      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("confirmReveal error:", e);
    }
  });

  // 16. Card click: Toggle Stage (Reveal word over character on 2nd click)
  socket.on('revealWordStage', ({ cardIndex }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      const gameState = room.gameState;
      if (!gameState) return;

      const card = gameState.board[cardIndex];
      if (!card || !card.revealed) return;

      // Toggle stage 1 <-> 2
      card.stage = card.stage === 1 ? 2 : 1;

      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("revealWordStage error:", e);
    }
  });

  // 17. Send Emoji Reaction
  socket.on('sendEmoji', ({ emoji }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      player.emoji = emoji;
      io.to(currentRoomCode).emit('emojiTriggered', { playerId: player.id, emoji });

      // Automatically reset player emoji status after 3 seconds
      setTimeout(() => {
        const r = rooms[currentRoomCode];
        if (r) {
          const p = r.players.find(x => x.id === player.id);
          if (p) {
            p.emoji = null;
            io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
          }
        }
      }, 3000);

      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("sendEmoji error:", e);
    }
  });

  // 18. Send Chat Message
  socket.on('sendChat', ({ text }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const msg = {
        sender: player.name,
        team: player.team,
        text: text,
        time: time
      };

      io.to(currentRoomCode).emit('chatMsg', msg);
    } catch (e) {
      console.error("sendChat error:", e);
    }
  });

  // 18.5. Send Leader Chat Message (Spymasters Only)
  socket.on('sendLeaderChat', ({ text }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      // Only spymasters (liderler) can participate in leader chat
      if (player.role !== 'spymaster') return;

      const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const msg = {
        sender: player.name,
        team: player.team,
        text: text,
        time: time
      };

      // Broadcast ONLY to the spymasters of this room
      room.players.forEach(p => {
        if (p.role === 'spymaster') {
          io.to(p.id).emit('leaderChatMsg', msg);
        }
      });
    } catch (e) {
      console.error("sendLeaderChat error:", e);
    }
  });

  // 19. Team Name Customization (Host Only)
  socket.on('updateTeamName', ({ team, name }) => {
    try {
      console.log(`[DEBUG] updateTeamName requested: room=${currentRoomCode}, team=${team}, name=${name}, socket=${socket.id}`);
      if (!currentRoomCode || !rooms[currentRoomCode]) {
        console.log(`[DEBUG] updateTeamName failed: room not found for code "${currentRoomCode}"`);
        return;
      }
      const room = rooms[currentRoomCode];
      console.log(`[DEBUG] Room hostId=${room.hostId}, socketId=${socket.id}, isHost=${isHost(room)}`);
      if (!isHost(room)) {
        console.log("[DEBUG] updateTeamName failed: isHost check failed");
        return;
      }

      const cleanName = name.trim() || (team === 'red' ? 'KIRMIZI TAKIM' : 'MAVİ TAKIM');
      if (!room.teamNames) room.teamNames = { red: "KIRMIZI TAKIM", blue: "MAVİ TAKIM" };
      room.teamNames[team] = cleanName;
      if (room.gameState && room.gameState.teamNames) {
        room.gameState.teamNames[team] = cleanName;
      }
      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
      console.log(`[DEBUG] updateTeamName success! newName=${cleanName}`);
    } catch (e) {
      console.error("updateTeamName error:", e);
    }
  });

  // 20. Restart / Reset Game (Host Only)
  socket.on('restartGame', () => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      if (!isHost(room)) return socket.emit('errorMsg', 'Oyunu sadece lider yeniden başlatabilir.');

      initGame(room);
      startServerTimer(currentRoomCode);
      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("restartGame error:", e);
    }
  });

  // 21. Lobby Reset / Return to Lobby (Host Only)
  socket.on('resetToLobby', () => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      if (!isHost(room)) return socket.emit('errorMsg', 'Lobiyi sadece lider sıfırlayabilir.');

      stopServerTimer(currentRoomCode);
      room.gameStarted = false;
      room.gameEnded = false;
      room.gameState = null;

      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("resetToLobby error:", e);
    }
  });

  // 22. Disconnect Handler (With 30 seconds reconnect grace period)
  socket.on('disconnect', () => {
    try {
      if (currentRoomCode && rooms[currentRoomCode] && currentPlayerId) {
        const room = rooms[currentRoomCode];
        const player = room.players.find(p => p.playerId === currentPlayerId);
        
        if (player) {
          player.connected = false;
          console.log(`Player disconnected (grace period started): ${player.name} (${currentPlayerId})`);

          // 30 Seconds reconnection grace period
          playerDisconnectTimers[currentPlayerId] = setTimeout(() => {
            const r = rooms[currentRoomCode];
            if (r) {
              const idx = r.players.findIndex(p => p.playerId === currentPlayerId);
              if (idx !== -1 && !r.players[idx].connected) {
                const name = r.players[idx].name;
                r.players.splice(idx, 1);
                console.log(`Player removed permanently: ${name} (${currentPlayerId})`);

                // If host disconnected, automatically promote the next connected human player
                if (r.hostId === socket.id) {
                  const nextHost = r.players.find(p => !p.isBot && p.connected);
                  if (nextHost) {
                    r.hostId = nextHost.id;
                    nextHost.isHost = true;
                    addLog(r, `Oda lideri koptuğu için liderlik otomatik olarak ${nextHost.name} oyuncusuna devredildi.`);
                    console.log(`Host migrated: ${nextHost.name} is the new host of room ${currentRoomCode}`);
                  }
                }

                addLog(r, `${name} oyundan ayrıldı.`);

                // Empty Room Cleanup: If no human players remain in the room
                const activeHumans = r.players.filter(p => !p.isBot && p.connected);
                if (activeHumans.length === 0) {
                  console.log(`Room ${currentRoomCode} has no human players. Cleanup scheduled in 5 minutes.`);
                  roomCleanupTimers[currentRoomCode] = setTimeout(() => {
                    stopServerTimer(currentRoomCode);
                    delete rooms[currentRoomCode];
                    console.log(`Room ${currentRoomCode} deleted automatically due to 5 minutes of inactivity.`);
                  }, 5 * 60 * 1000);
                }

                io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
              }
            }
          }, 30 * 1000);
        }
      }
    } catch (e) {
      console.error("disconnect error:", e);
    }
  });

});

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Local URL: http://localhost:${PORT}`);
});
