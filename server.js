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

// Middleware for parsing JSON requests (needed for feedback submission)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Feedbacks Data Helpers
const FEEDBACKS_FILE = path.join(__dirname, 'feedbacks.json');

function getFeedbacks() {
  try {
    if (!fs.existsSync(FEEDBACKS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(FEEDBACKS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (e) {
    console.error("getFeedbacks error:", e);
    return [];
  }
}

function saveFeedback(feedback) {
  try {
    const list = getFeedbacks();
    list.push(feedback);
    fs.writeFileSync(FEEDBACKS_FILE, JSON.stringify(list, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error("saveFeedback error:", e);
    return false;
  }
}

// REST API: Submit new feedback
app.post('/api/feedback', (req, res) => {
  try {
    const { name, text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Mesaj boş olamaz.' });
    }

    const time = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const success = saveFeedback({
      name: name ? name.trim() : 'Anonim',
      text: text.trim(),
      time
    });

    res.json({ success });
  } catch (e) {
    console.error('API feedback post error:', e);
    res.status(500).json({ success: false, error: 'Sunucu hatası.' });
  }
});

// Helper to check if admin is authenticated via cookies
function checkAdminAuth(req) {
  try {
    if (!req.headers.cookie) return false;
    const cookies = Object.fromEntries(
      req.headers.cookie.split(';').map(c => {
        const parts = c.trim().split('=');
        return [parts[0], parts.slice(1).join('=')];
      })
    );
    return cookies.admin_session === 'authenticated_3131';
  } catch (e) {
    console.error('checkAdminAuth error:', e);
    return false;
  }
}

// POST Route: Login handler for admin password check
app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === '3131') {
    // Set a session cookie valid for 7 days
    res.setHeader('Set-Cookie', 'admin_session=authenticated_3131; Path=/; HttpOnly; Max-Age=604800');
    return res.redirect('/admin');
  }
  res.redirect('/admin?error=1');
});

// POST Route: Delete a specific feedback entry by its index
app.post('/admin/delete-feedback', (req, res) => {
  try {
    if (!checkAdminAuth(req)) {
      return res.status(401).json({ success: false, error: 'Yetkisiz erişim.' });
    }

    const { index } = req.body;
    if (index === undefined || index === null) {
      return res.status(400).json({ success: false, error: 'Geçersiz dizin.' });
    }

    const feedbacks = getFeedbacks();
    const targetIndex = parseInt(index);
    if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= feedbacks.length) {
      return res.status(400).json({ success: false, error: 'Dizin bulunamadı.' });
    }

    // Remove feedback at index
    feedbacks.splice(targetIndex, 1);
    fs.writeFileSync(FEEDBACKS_FILE, JSON.stringify(feedbacks, null, 2), 'utf8');

    res.json({ success: true });
  } catch (e) {
    console.error('Delete feedback error:', e);
    res.status(500).json({ success: false, error: 'Sunucu hatası.' });
  }
});

// REST Route: Admin dashboard showing all feedbacks with authentication & deletion
app.get('/admin', (req, res) => {
  try {
    const errorParam = req.query.error;

    // 1. Render Login Screen if not authenticated
    if (!checkAdminAuth(req)) {
      const loginHTML = `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>IOWFNAMES - Admin Girişi</title>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
          <style>
            body {
              background-color: #0b0f19;
              color: #ffffff;
              font-family: 'Outfit', sans-serif;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background-image: radial-gradient(circle at 50% 50%, rgba(0, 210, 255, 0.05) 0%, transparent 60%);
            }
            .login-card {
              background: rgba(16, 22, 37, 0.85);
              border: 1px solid rgba(0, 210, 255, 0.25);
              border-radius: 16px;
              padding: 2.5rem;
              width: 100%;
              max-width: 400px;
              box-shadow: 0 0 35px rgba(0, 210, 255, 0.15);
              backdrop-filter: blur(10px);
              text-align: center;
            }
            h2 {
              font-family: 'Space Grotesk', sans-serif;
              margin-top: 0;
              margin-bottom: 1.5rem;
              background: linear-gradient(90deg, #00d2ff, #ff3860);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            input {
              width: 100%;
              background: rgba(0,0,0,0.35);
              border: 1px solid rgba(255,255,255,0.1);
              border-radius: 8px;
              padding: 0.75rem 1rem;
              color: #fff;
              font-size: 1rem;
              margin-bottom: 1.5rem;
              text-align: center;
              outline: none;
              box-sizing: border-box;
              font-family: var(--font-body);
            }
            input:focus {
              border-color: #00d2ff;
              box-shadow: 0 0 10px rgba(0, 210, 255, 0.3);
            }
            button {
              width: 100%;
              background: linear-gradient(135deg, #00d2ff, #0088cc);
              color: white;
              border: none;
              padding: 0.75rem;
              border-radius: 8px;
              font-weight: bold;
              font-size: 1rem;
              cursor: pointer;
              transition: all 0.3s;
            }
            button:hover {
              box-shadow: 0 0 15px rgba(0, 210, 255, 0.5);
              transform: translateY(-1px);
            }
            .error-msg {
              color: #ff3860;
              font-size: 0.85rem;
              margin-bottom: 1rem;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="login-card">
            <h2><i class="fa-solid fa-lock"></i> Yönetici Girişi</h2>
            ${errorParam ? `<div class="error-msg">Hatalı Şifre! Lütfen tekrar deneyin.</div>` : ''}
            <form action="/admin/login" method="POST">
              <input type="password" name="password" placeholder="Yönetici Şifresi..." required autofocus autocomplete="off">
              <button type="submit">Giriş Yap</button>
            </form>
          </div>
        </body>
        </html>
      `;
      return res.send(loginHTML);
    }

    // 2. Render authenticated Admin Dashboard
    // Map with original indices before reversing to ensure correct deletion index mapping
    const feedbacksList = getFeedbacks()
      .map((fb, idx) => ({ ...fb, originalIndex: idx }))
      .reverse(); // Show latest first
    
    let tableRows = '';
    if (feedbacksList.length === 0) {
      tableRows = `<tr><td colspan="4" style="text-align: center; color: #ff3860; padding: 2rem;">Henüz geri bildirim alınmadı.</td></tr>`;
    } else {
      feedbacksList.forEach(fb => {
        tableRows += `
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); transition: background 0.2s;">
            <td style="padding: 1rem; color: #ffd700; font-weight: bold; font-family: 'Space Grotesk', sans-serif;">${escapeHTMLString(fb.name)}</td>
            <td style="padding: 1rem; color: #e5e7eb; white-space: pre-wrap; font-size: 0.9rem;">${escapeHTMLString(fb.text)}</td>
            <td style="padding: 1rem; color: #00d2ff; font-size: 0.8rem; white-space: nowrap;">${fb.time}</td>
            <td style="padding: 1rem; text-align: center; white-space: nowrap;">
              <button onclick="deleteFeedback(${fb.originalIndex})" class="delete-action-btn">
                <i class="fa-solid fa-trash"></i> Sil
              </button>
            </td>
          </tr>
        `;
      });
    }

    const adminHTML = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IOWFNAMES - Geri Bildirim Yönetim Paneli</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
          body {
            background-color: #0b0f19;
            color: #ffffff;
            font-family: 'Outfit', sans-serif;
            margin: 0;
            padding: 2rem;
            min-height: 100vh;
            background-image: radial-gradient(circle at 10% 20%, rgba(0, 210, 255, 0.05) 0%, transparent 40%),
                              radial-gradient(circle at 90% 80%, rgba(255, 56, 96, 0.05) 0%, transparent 40%);
          }
          .admin-card {
            max-width: 1050px;
            margin: 0 auto;
            background: rgba(16, 22, 37, 0.65);
            border: 1px solid rgba(0, 210, 255, 0.2);
            border-radius: 16px;
            padding: 2rem;
            box-shadow: 0 0 25px rgba(0, 210, 255, 0.1);
            backdrop-filter: blur(10px);
          }
          header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid rgba(0, 210, 255, 0.3);
            padding-bottom: 1rem;
            margin-bottom: 2rem;
          }
          h1 {
            font-family: 'Space Grotesk', sans-serif;
            margin: 0;
            background: linear-gradient(90deg, #00d2ff, #ff3860);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }
          .home-btn {
            background: rgba(0, 210, 255, 0.1);
            color: #00d2ff;
            border: 1px solid rgba(0, 210, 255, 0.3);
            padding: 0.5rem 1rem;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            transition: all 0.3s ease;
          }
          .home-btn:hover {
            background: rgba(0, 210, 255, 0.2);
            box-shadow: 0 0 12px rgba(0, 210, 255, 0.4);
            color: #fff;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
          }
          th {
            font-family: 'Space Grotesk', sans-serif;
            color: #9ca3af;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 1rem;
            border-bottom: 2px solid rgba(255, 255, 255, 0.1);
          }
          tr:hover {
            background: rgba(255, 255, 255, 0.02);
          }
          .delete-action-btn {
            background: rgba(255, 56, 96, 0.12);
            border: 1px solid rgba(255, 56, 96, 0.35);
            color: #ff3860;
            padding: 0.45rem 0.9rem;
            border-radius: 6px;
            font-weight: bold;
            font-size: 0.82rem;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .delete-action-btn:hover {
            background: #ff3860;
            color: #fff;
            box-shadow: 0 0 12px rgba(255, 56, 96, 0.4);
            transform: scale(1.02);
          }
        </style>
      </head>
      <body>
        <div class="admin-card">
          <header>
            <h1><i class="fa-solid fa-comments"></i> Geri Bildirim Yönetimi</h1>
            <a href="/" class="home-btn"><i class="fa-solid fa-house"></i> Oyuna Dön</a>
          </header>
          <table>
            <thead>
              <tr>
                <th style="width: 20%;">Gönderen</th>
                <th style="width: 50%;">Geri Bildirim Mesajı</th>
                <th style="width: 20%;">Tarih</th>
                <th style="width: 10%; text-align: center;">Eylemler</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>

        <script>
          function deleteFeedback(originalIndex) {
            if (confirm("Bu geri bildirimi silmek istediğinize emin misiniz?")) {
              fetch('/admin/delete-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index: originalIndex })
              })
              .then(res => res.json())
              .then(data => {
                if (data.success) {
                  window.location.reload();
                } else {
                  alert("Hata: " + (data.error || "Silme işlemi başarısız."));
                }
              })
              .catch(err => {
                console.error(err);
                alert("Bağlantı hatası oluştu.");
              });
            }
          }
        </script>
      </body>
      </html>
    `;
    res.send(adminHTML);
  } catch (e) {
    console.error('Admin route error:', e);
    res.status(500).send('Admin paneli yüklenirken hata oluştu.');
  }
});

// Helper function to escape HTML strings for safety
function escapeHTMLString(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// REST API: Get public lobby list
app.get('/api/lobbies', (req, res) => {
  try {
    const publicLobbies = [];
    for (const code in rooms) {
      const room = rooms[code];
      if (room.isPublic && !room.gameStarted) {
        const humanPlayers = room.players.filter(p => !p.isBot && p.connected);
        const host = room.players.find(p => p.isHost);
        publicLobbies.push({
          roomCode: room.roomCode,
          hostName: host ? host.name : 'Bilinmeyen',
          playerCount: humanPlayers.length,
          maxPlayers: room.settings.maxPlayers,
          teamNames: room.teamNames || { red: 'KIRMIZI TAKIM', blue: 'MAVİ TAKIM' }
        });
      }
    }
    res.json({ lobbies: publicLobbies });
  } catch (e) {
    console.error('API lobbies error:', e);
    res.json({ lobbies: [] });
  }
});

// Route for short room links: /ROOMCODE
app.get('/:roomCode', (req, res) => {
  const code = req.params.roomCode.toUpperCase();
  // If it's a 6-letter alphabetic string, serve the main game page
  if (/^[A-Z]{6}$/.test(code)) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).send('Not Found');
  }
});

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
    
    files.forEach((file, index) => {
      const ext = path.extname(file).toLowerCase();
      if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
        const baseName = path.basename(file, ext);
        let extractedName = baseName.toUpperCase();
        
        // Remove "character" prefix if it exists by any chance
        if (extractedName.startsWith("CHARACTER")) {
          extractedName = extractedName.substring("CHARACTER".length).replace(/^[\-_]/, '').trim();
        }

        // Remove trailing numbers or indices if they exist (e.g. NAME_1 -> NAME)
        extractedName = extractedName.replace(/_\d+$/, '').trim();
        
        chars.push({
          image: `/logos/characters/${file}`,
          name: extractedName || `KARAKTER ${index + 1}`,
          index: index + 1
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
      let charImage = "";
      let charName = "";
      
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
    isPublic: room.isPublic || false,
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
        isPublic: false,
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
        ready: true,
        glow: 'none'
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
        if (!playerInfo.isHost) {
          playerInfo.ready = false; // Reset ready status on reconnect
        }
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
          ready: false,
          glow: 'none'
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
      if (!player.isHost) {
        player.ready = false;
      }

      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("selectTeamRole error:", e);
    }
  });

  // 3.5. Toggle Ready Status (For active team players)
  socket.on('toggleReady', () => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      // Only team players who are not the host need to toggle ready
      if (player.team !== 'spectator' && !player.isHost) {
        player.ready = !player.ready;
        io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
      }
    } catch (e) {
      console.error("toggleReady error:", e);
    }
  });

  // 3.6. Update Namecard Glow Color
  socket.on('updateGlow', ({ glow }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      const validGlows = ['none', 'gold', 'purple', 'green', 'cyan', 'pink'];
      if (validGlows.includes(glow)) {
        player.glow = glow;
        io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
      }
    } catch (e) {
      console.error("updateGlow error:", e);
    }
  });

  // 3.7. Change Player Name (For guest links)
  socket.on('changeName', ({ name }) => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      const nameClean = name ? name.trim() : '';
      if (!nameClean) {
        return socket.emit('errorMsg', 'Lütfen geçerli bir takma ad girin.');
      }
      
      const duplicateName = room.players.find(p => p.name.toUpperCase() === nameClean.toUpperCase() && p.id !== socket.id && !p.isBot);
      if (duplicateName) {
        return socket.emit('errorMsg', 'Bu isimde başka bir oyuncu odada zaten mevcut.');
      }

      player.name = nameClean;
      
      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
      socket.emit('nameChangeSuccess');
    } catch (e) {
      console.error("changeName error:", e);
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

  // 4.5. Toggle Public/Private Lobby (Host Only)
  socket.on('togglePublic', () => {
    try {
      if (!currentRoomCode || !rooms[currentRoomCode]) return;
      const room = rooms[currentRoomCode];
      if (!isHost(room)) return socket.emit('errorMsg', 'Lobi gizliliğini sadece lider değiştirebilir.');

      room.isPublic = !room.isPublic;
      io.to(currentRoomCode).emit('roomState', getRoomClientData(currentRoomCode));
    } catch (e) {
      console.error("togglePublic error:", e);
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

      // Check ready status for all active team players (excluding host/bots)
      const unreadyPlayers = room.players.filter(p => p.team !== 'spectator' && !p.isHost && !p.isBot && !p.ready);
      if (unreadyPlayers.length > 0) {
        const names = unreadyPlayers.map(p => p.name).join(', ');
        return socket.emit('errorMsg', `Oyuna başlamak için tüm aktif oyuncuların hazır olması gerekir. Hazır olmayanlar: ${names}`);
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

      // Enforce username validation for 'Teslav2' or 'Tesla.v2' (case-insensitive) on the server side
      const player = room.players.find(p => p.id === socket.id);
      if (!player || (player.name.toLowerCase() !== 'teslav2' && player.name.toLowerCase() !== 'tesla.v2')) {
        return socket.emit('errorMsg', 'Test modunu başlatma yetkiniz yok.');
      }

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
