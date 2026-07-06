// Safe SessionStorage Helper Functions (Avoids SecurityError crashes in private/restricted browsers)
function safeGetStorage(key) {
  try {
    return sessionStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function safeSetStorage(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch (e) { }
}

function safeRemoveStorage(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (e) { }
}

// Helper: Generate UUID for playerId
function generateUUID() {
  return 'pid-' + Math.random().toString(36).substr(2, 9) + '-' + Math.random().toString(36).substr(2, 9);
}

// Initialize unique Player ID
let localPlayerId = safeGetStorage('playerId');
if (!localPlayerId) {
  localPlayerId = generateUUID();
  safeSetStorage('playerId', localPlayerId);
}

// App Variables
let socket = null;
let myPlayerInfo = {
  id: "local-player",
  playerId: localPlayerId,
  name: "Ajan_Teslav",
  team: "spectator",
  role: "agent",
  isHost: true,
  isBot: false
};
let activeRoomCode = "";
let activeRoomPassword = "";
let roomAdminId = "";

// Timer local tracking
let timerInterval = null;
let timerSecondsRemaining = 90;
let isUnlimitedTimer = false;
let lastTurnStateKey = '';
let lastClueKey = '';
let lastTurnTeam = '';
let lastTurnRole = '';
let soundMuted = false;
let roomCodeHidden = false;
let inspectedCardIndices = new Set();
let winnerModalDismissed = false;
let isAutoReconnecting = false;

// DOM Elements - Screens
const screenLanding = document.getElementById('screen-landing');
const screenLobby = document.getElementById('screen-lobby');
const screenGame = document.getElementById('screen-game');

// Landing Elements
const usernameInput = document.getElementById('username-input');
const roomCodeInput = document.getElementById('room-code-input');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');

// Lobby Set Password & Custom Modal Elements
const lobbySetPasswordInput = document.getElementById('lobby-set-password-input');
const copyLobbyPasswordBtn = document.getElementById('copy-lobby-password-btn');
const modalPasswordGroup = document.getElementById('modal-password-group');
const modalPasswordInput = document.getElementById('modal-password-input');
const modalPasswordError = document.getElementById('modal-password-error');
const modalUsernameGroup = document.getElementById('modal-username-group');
const usernameModalSubtitle = document.getElementById('username-modal-subtitle');

// Lobby Elements
const displayRoomCode = document.getElementById('display-room-code');
const copyCodeBtn = document.getElementById('copy-code-btn');
const shareRoomBtn = document.getElementById('share-room-btn');
const startGameBtn = document.getElementById('start-game-btn');
const testModeBtn = document.getElementById('test-mode-btn');
const toggleReadyBtn = document.getElementById('toggle-ready-btn');
const leaveRoomBtns = document.querySelectorAll('.leave-room-btn');

// Lobby Listings
const lobbyRedSpymaster = document.getElementById('lobby-red-spymaster');
const lobbyRedAgents = document.getElementById('lobby-red-agents');
const lobbyBlueSpymaster = document.getElementById('lobby-blue-spymaster');
const lobbyBlueAgents = document.getElementById('lobby-blue-agents');
const spectatorList = document.getElementById('spectator-list');

// Host Settings Panels
const lobbyAdminControls = document.getElementById('lobby-admin-controls');
const turnDurationSelect = document.getElementById('turn-duration-select');
const maxPlayersSelect = document.getElementById('max-players-select');
const wordPoolSelect = document.getElementById('word-pool-select');
const shuffleTeamsBtn = document.getElementById('shuffle-teams-btn');

// Room Panel (Chat/Players tabs)
const tabChatBtn = document.getElementById('tab-chat-btn');
const tabPlayersBtn = document.getElementById('tab-players-btn');
const chatTabContent = document.getElementById('chat-tab-content');
const playersTabContent = document.getElementById('players-tab-content');
const lobbyChatBox = document.getElementById('lobby-chat-box');
const lobbyChatForm = document.getElementById('lobby-chat-form');
const lobbyChatInput = document.getElementById('lobby-chat-input');
const adminPlayersBox = document.getElementById('admin-players-box');
const playerCountLobby = document.getElementById('player-count-lobby');

// Game Screen Listings
const redTeamNameInput = document.getElementById('red-team-name');
const blueTeamNameInput = document.getElementById('blue-team-name');
const redScoreVal = document.getElementById('red-score-val');
const blueScoreVal = document.getElementById('blue-score-val');
const gameRedSpymaster = document.getElementById('game-red-spymaster');
const gameRedAgents = document.getElementById('game-red-agents');
const gameBlueSpymaster = document.getElementById('game-blue-spymaster');
const gameBlueAgents = document.getElementById('game-blue-agents');

// Timer
const timerTitleText = document.getElementById('timer-title-text');
const timerNum = document.getElementById('timer-num');
const timerBar = document.getElementById('timer-bar');

// Bottom Clue display/inputs
const clueDisplayMode = document.getElementById('clue-display-mode');
const displayClueWord = document.getElementById('display-clue-word');
const displayClueCount = document.getElementById('display-clue-count');
const displayRemainingGuesses = document.getElementById('display-remaining-guesses');

const clueInputMode = document.getElementById('clue-input-mode');
const clueForm = document.getElementById('clue-form');
const inputClueWord = document.getElementById('input-clue-word');
const inputClueCount = document.getElementById('input-clue-count');
const btnCountDec = document.getElementById('btn-count-dec');
const btnCountInc = document.getElementById('btn-count-inc');
const btnSendClue = document.getElementById('btn-send-clue');
const btnPassTurn = document.getElementById('btn-pass-turn');

// Footer & actions
const myRoleDisplay = document.getElementById('my-role-display');
const btnRestartGame = document.getElementById('btn-restart-game');
const btnResetLobby = document.getElementById('btn-reset-lobby');
const cardsGrid = document.getElementById('cards-grid');
const logMessages = document.getElementById('log-messages');

// Modal Elements
const rulesBtn = document.getElementById('rules-btn');
const rulesModal = document.getElementById('rules-modal');
const closeRulesBtn = document.getElementById('close-rules-btn');
const gameoverModal = document.getElementById('gameover-modal');
const winnerTeamText = document.getElementById('winner-team-text');
const winnerReasonText = document.getElementById('winner-reason-text');
const btnGameoverRestart = document.getElementById('btn-gameover-restart');
const btnGameoverLobby = document.getElementById('btn-gameover-lobby');
const btnGameoverClose = document.getElementById('btn-gameover-close');
const gameChatBox = document.getElementById('game-chat-box');
const leaderChatBox = document.getElementById('leader-chat-box');

// Defensive UI Helpers (Prevents JS crashes if elements are changed or missing)
function safeSetHTML(el, html) {
  if (el) el.innerHTML = html;
}

function safeSetText(el, text) {
  if (el) el.textContent = text;
}

function safeSetDisplay(el, display) {
  if (el) el.style.display = display;
}

function safeSetValue(el, value) {
  if (el) el.value = value;
}

// Audio Feedbacks
function playLocalSound(type) {
  if (soundMuted) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'click-correct') {
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'click-wrong') {
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'victory') {
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const oGain = ctx.createGain();
        o.connect(oGain);
        oGain.connect(ctx.destination);
        o.frequency.value = freq;
        oGain.gain.setValueAtTime(0.06, ctx.currentTime + i * 0.08);
        oGain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + i * 0.08 + 0.25);
        o.start(ctx.currentTime + i * 0.08);
        o.stop(ctx.currentTime + i * 0.08 + 0.25);
      });
    } else if (type === 'turn-change-my') {
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.4);
      osc.start();
      osc.stop(now + 0.4);
    } else if (type === 'turn-change-other') {
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(329.63, now);
      osc.frequency.exponentialRampToValueAtTime(440.00, now + 0.12);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.3);
      osc.start();
      osc.stop(now + 0.3);
    } else if (type === 'time-warning') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880.00, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    }
  } catch (e) { }
}

// Initialize Socket.io Connection
if (typeof io !== 'undefined') {
  socket = io();

  socket.on('connect', () => {
    // Auto-reconnect handshake if session details exist
    const savedRoom = safeGetStorage('roomCode');
    const savedName = safeGetStorage('playerName');
    if (savedRoom && savedName) {
      isAutoReconnecting = true;
      console.log(`Auto-reconnecting to room ${savedRoom} as ${savedName}...`);
      socket.emit('joinRoom', { roomCode: savedRoom, name: savedName, playerId: localPlayerId });
    }
  });

  socket.on('errorMsg', (msg) => {
    if (isAutoReconnecting && msg.includes('Oda bulunamadı')) {
      clearSavedSession();
      isAutoReconnecting = false;
      return;
    }
    isAutoReconnecting = false;

    // Show password errors directly in the modal instead of browser alerts
    if (msg.includes('şifre') || msg.includes('Şifre') || msg.includes('password') || msg.includes('Password')) {
      const modalErr = document.getElementById('modal-password-error');
      if (modalErr) {
        modalErr.textContent = msg;
        modalErr.style.display = 'block';
        return;
      }
    }

    alert(msg);
    // If room is not found, clear storage reconnect loop
    if (msg.includes('Oda bulunamadı')) {
      clearSavedSession();
    }
  });

  socket.on('kickedOut', () => {
    alert("Oda lideri tarafından odadan atıldınız.");
    clearSavedSession();
    stopTimer();
    switchScreen(screenLanding);
  });

  socket.on('bannedOut', () => {
    alert("Oda lideri tarafından odadan kalıcı olarak yasaklandınız.");
    clearSavedSession();
    stopTimer();
    switchScreen(screenLanding);
  });

  socket.on('roomCreated', ({ roomCode, player }) => {
    activeRoomCode = roomCode;
    myPlayerInfo = player;
    roomAdminId = player.id;
    isAutoReconnecting = false;

    // Save session details
    safeSetStorage('roomCode', roomCode);
    safeSetStorage('playerName', player.name);

    syncRoomCodeDisplay();
    switchScreen(screenLobby);
  });

  socket.on('roomJoined', ({ roomCode, player }) => {
    activeRoomCode = roomCode;
    myPlayerInfo = player;
    isAutoReconnecting = false;

    safeSetStorage('roomCode', roomCode);
    safeSetStorage('playerName', player.name);

    const modal = document.getElementById('username-modal-overlay');
    if (modal) {
      modal.classList.remove('active');
    }

    syncRoomCodeDisplay();
    switchScreen(screenLobby);
  });

  socket.on('lobbyPasswordRequired', ({ roomCode, name }) => {
    // Show password prompt modal (our custom modal!)
    const modal = document.getElementById('username-modal-overlay');
    if (modal) {
      if (modalPasswordError) modalPasswordError.style.display = 'none';
      if (modalPasswordInput) modalPasswordInput.value = '';

      // Check if they are joining via direct link
      const urlParams = new URLSearchParams(window.location.search);
      const roomCodeQuery = urlParams.get('room') || window.location.pathname.substring(1).toUpperCase();
      const isDirectLink = /^[A-Z]{3}$/.test(roomCodeQuery);

      if (isDirectLink) {
        if (modalUsernameGroup) modalUsernameGroup.style.display = 'block';
        if (modalPasswordGroup) modalPasswordGroup.style.display = 'block';
        if (usernameModalSubtitle) {
          usernameModalSubtitle.textContent = 'Bu oda şifrelidir. Giriş yapmak için takma adınızı ve oda şifresini girin.';
        }
      } else {
        if (modalUsernameGroup) modalUsernameGroup.style.display = 'none';
        if (modalPasswordGroup) modalPasswordGroup.style.display = 'block';
        if (usernameModalSubtitle) {
          usernameModalSubtitle.textContent = 'Bu oda şifrelidir. Lütfen oda şifresini girin.';
        }
      }

      // Store target details on join button
      const joinBtn = document.getElementById('modal-join-btn');
      if (joinBtn) {
        joinBtn.setAttribute('data-target-room-code', roomCode);
        joinBtn.setAttribute('data-target-username', name);
      }

      modal.classList.add('active');
      setTimeout(() => {
        if (modalPasswordInput) modalPasswordInput.focus();
      }, 150);
    }
  });

  socket.on('roomState', (roomData) => {
    if (!roomData) return;

    roomAdminId = roomData.hostId;
    activeRoomPassword = roomData.password || "";
    const me = roomData.players.find(p => p.playerId === localPlayerId);
    if (me) myPlayerInfo = me;

    // Automatically close direct link username modal when successfully joined with a non-temporary name
    if (me && !me.name.startsWith('Katılımcı#')) {
      const usernameModal = document.getElementById('username-modal-overlay');
      if (usernameModal) usernameModal.classList.remove('active');
    }

    // Sync room code and password display
    syncRoomCodeDisplay();

    // Sync lobby team names
    if (roomData.teamNames) {
      const redHeader = document.getElementById('lobby-red-team-name-text');
      const blueHeader = document.getElementById('lobby-blue-team-name-text');
      if (redHeader && !redHeader.querySelector('input')) redHeader.textContent = roomData.teamNames.red;
      if (blueHeader && !blueHeader.querySelector('input')) blueHeader.textContent = roomData.teamNames.blue;
    }

    // Show/Hide admin settings
    const isAdmin = socket.id === roomAdminId;
    
    // Sync password settings on the lobby screen
    if (lobbySetPasswordInput) {
      if (isAdmin) {
        lobbySetPasswordInput.disabled = false;
        lobbySetPasswordInput.value = roomData.password || "";
        if (copyLobbyPasswordBtn) copyLobbyPasswordBtn.style.display = 'flex';
      } else {
        lobbySetPasswordInput.disabled = true;
        lobbySetPasswordInput.value = roomData.password ? "••••••••" : "";
        if (copyLobbyPasswordBtn) copyLobbyPasswordBtn.style.display = 'none';
      }
    }

    safeSetDisplay(lobbyAdminControls, isAdmin ? 'block' : 'none');
    safeSetDisplay(startGameBtn, isAdmin ? 'block' : 'none');

    // Test mode button is only visible to the host if their username is 'Teslav2' or 'Tesla.v2' (case-insensitive)
    const isTeslaName = myPlayerInfo && myPlayerInfo.name &&
      (myPlayerInfo.name.toLowerCase() === 'teslav2' || myPlayerInfo.name.toLowerCase() === 'tesla.v2');
    safeSetDisplay(testModeBtn, (isAdmin && isTeslaName) ? 'block' : 'none');

    safeSetDisplay(btnRestartGame, isAdmin ? 'block' : 'none');
    safeSetDisplay(btnResetLobby, isAdmin ? 'block' : 'none');
    safeSetDisplay(document.getElementById('btn-edit-red-team'), isAdmin ? 'inline-block' : 'none');
    safeSetDisplay(document.getElementById('btn-edit-blue-team'), isAdmin ? 'inline-block' : 'none');

    // Sync settings
    if (!isAdmin && roomData.settings) {
      safeSetValue(turnDurationSelect, roomData.settings.turnDuration);
      safeSetValue(maxPlayersSelect, roomData.settings.maxPlayers);
      safeSetValue(wordPoolSelect, roomData.settings.wordPool);
    }

    // Sync Room Password controls
    const lobbySetPasswordInput = document.getElementById('lobby-set-password-input');
    const btnSetLobbyPassword = document.getElementById('btn-set-lobby-password');
    const copyLobbyPasswordBtn = document.getElementById('copy-lobby-password-btn');

    if (lobbySetPasswordInput) {
      if (isAdmin) {
        // Host can edit password
        lobbySetPasswordInput.disabled = false;
        // Don't overwrite what host is currently typing if they are focused
        if (document.activeElement !== lobbySetPasswordInput) {
          lobbySetPasswordInput.value = roomData.password || '';
        }
        lobbySetPasswordInput.placeholder = 'Şifresiz';
      } else {
        // Guest cannot edit
        lobbySetPasswordInput.disabled = true;
        lobbySetPasswordInput.value = roomData.password ? '••••••••' : '';
        lobbySetPasswordInput.placeholder = 'Şifresiz';
      }
    }

    if (btnSetLobbyPassword) {
      btnSetLobbyPassword.style.display = isAdmin ? 'inline-block' : 'none';
    }
    if (copyLobbyPasswordBtn) {
      copyLobbyPasswordBtn.style.display = (isAdmin && roomData.password) ? 'inline-block' : 'none';
    }



    // Sync Ready Button for regular team players
    if (toggleReadyBtn) {
      const showReadyBtn = !myPlayerInfo.isHost && myPlayerInfo.team !== 'spectator';
      safeSetDisplay(toggleReadyBtn, showReadyBtn ? 'block' : 'none');

      if (myPlayerInfo.ready) {
        toggleReadyBtn.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Hazır Değil Yap';
        toggleReadyBtn.className = 'btn btn-danger w-100 mt-5';
      } else {
        toggleReadyBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Hazır Ol';
        toggleReadyBtn.className = 'btn btn-local w-100 mt-5';
      }
    }

    renderLobbyPlayers(roomData.players);
    renderLobbyPlayersAdminList(roomData.players);

    if (roomData.gameStarted) {
      switchScreen(screenGame);
      renderGame(roomData.gameState, roomData.players, roomData.settings);
    } else {
      // Reset turn tracking variables when back in lobby
      lastTurnTeam = '';
      lastTurnRole = '';
      const glowBg = document.querySelector('.glow-bg');
      if (glowBg) {
        glowBg.classList.remove('turn-red', 'turn-blue');
      }
      switchScreen(screenLobby);
    }
  });

  // Realtime Timer Synchronizer
  socket.on('timerTick', ({ remaining }) => {
    timerSecondsRemaining = remaining;
    if (!isUnlimitedTimer) {
      updateTimerUI(timerSecondsRemaining, parseInt((turnDurationSelect && turnDurationSelect.value) || 90));

      // Play warning sound in final 5 seconds
      if (remaining <= 5 && remaining > 0) {
        playLocalSound('time-warning');
      }
    }
  });

  socket.on('chatMsg', (msg) => {
    appendChatBubble(msg, 'genel');
  });

  socket.on('leaderChatMsg', (msg) => {
    appendChatBubble(msg, 'lider');
  });
}

function clearSavedSession() {
  safeRemoveStorage('roomCode');
  safeRemoveStorage('playerName');
  activeRoomCode = "";
}

// --- SCREEN NAVIGATION ---
function switchScreen(targetScreen) {
  if (!targetScreen) return;
  if (targetScreen.classList.contains('active')) return; // Exit early if already on this screen

  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.opacity = 0;
  });
  targetScreen.classList.add('active');
  setTimeout(() => {
    targetScreen.style.opacity = 1;
  }, 50);
}

// --- LANDING SCREEN EVENT HANDLERS ---
if (createRoomBtn) {
  createRoomBtn.addEventListener('click', () => {
    const name = usernameInput ? usernameInput.value.trim() : '';
    if (!name) return alert("Lütfen bir isim girin.");

    if (socket) {
      socket.emit('createRoom', { name, playerId: localPlayerId, password: '' });
    }
  });
}

if (joinRoomBtn) {
  joinRoomBtn.addEventListener('click', () => {
    const name = usernameInput ? usernameInput.value.trim() : '';
    const code = roomCodeInput ? roomCodeInput.value.trim().toUpperCase() : '';
    if (!name) return alert("Lütfen bir isim girin.");
    if (!code) return alert("Lütfen oda kodunu girin.");

    if (socket) {
      socket.emit('joinRoom', { roomCode: code, name, playerId: localPlayerId, password: '' });
    }
  });
}

// --- BROWSE LOBBIES MODAL ---
const browseLobbiesBtn = document.getElementById('browse-lobbies-btn');
const lobbiesModalOverlay = document.getElementById('lobbies-modal-overlay');
const closeLobbiesModal = document.getElementById('close-lobbies-modal');
const refreshLobbiesBtn = document.getElementById('refresh-lobbies-btn');
const lobbiesList = document.getElementById('lobbies-list');

function fetchAndRenderLobbies() {
  if (!lobbiesList) return;
  lobbiesList.innerHTML = '<div class="lobbies-empty"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; opacity: 0.4; margin-bottom: 0.5rem;"></i><p>Yükleniyor...</p></div>';

  fetch('/api/lobbies')
    .then(res => res.json())
    .then(data => {
      if (!data.lobbies || data.lobbies.length === 0) {
        lobbiesList.innerHTML = '<div class="lobbies-empty"><i class="fa-solid fa-ghost" style="font-size: 2rem; opacity: 0.3; margin-bottom: 0.5rem;"></i><p>Şu an herkese açık aktif lobi bulunamadı.</p></div>';
        return;
      }

      lobbiesList.innerHTML = '';
      data.lobbies.forEach(lobby => {
        const maxText = lobby.maxPlayers === 'unlimited' ? '∞' : lobby.maxPlayers;
        const item = document.createElement('div');
        item.className = 'lobby-list-item';
        
        // Render 🔒 for password-protected rooms, 🌍 for open public rooms
        const statusBadge = lobby.hasPassword ? '<span style="margin-right: 0.4rem; font-size: 0.82rem;" title="Şifreli Oda">🔒</span>' : '<span style="margin-right: 0.4rem; font-size: 0.82rem;" title="Şifresiz Oda">🌍</span>';
        
        item.innerHTML = `
          <div class="lobby-list-info">
            <div class="lobby-list-host">${statusBadge}<i class="fa-solid fa-crown" style="color: #ffd700; font-size: 0.75rem;"></i> ${lobby.hostName}</div>
            <div class="lobby-list-meta">
              <span><i class="fa-solid fa-users"></i> ${lobby.playerCount}/${maxText}</span>
              <span><i class="fa-solid fa-key"></i> ***</span>
            </div>
          </div>
          <button class="lobby-join-btn" data-code="${lobby.roomCode}">Katıl <i class="fa-solid fa-right-to-bracket"></i></button>
        `;
        lobbiesList.appendChild(item);
      });

      // Attach join click to lobby cards
      lobbiesList.querySelectorAll('.lobby-join-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.dataset.code;
          const name = usernameInput ? usernameInput.value.trim() : '';
          if (!name) {
            alert("Lütfen önce ana sayfada bir takma ad girin.");
            if (lobbiesModalOverlay) lobbiesModalOverlay.classList.remove('active');
            return;
          }
          if (lobbiesModalOverlay) lobbiesModalOverlay.classList.remove('active');
          if (socket) {
            socket.emit('joinRoom', { roomCode: code, name, playerId: localPlayerId });
          }
        });
      });
    })
    .catch(err => {
      console.error('Lobby fetch error:', err);
      lobbiesList.innerHTML = '<div class="lobbies-empty"><i class="fa-solid fa-triangle-exclamation" style="font-size: 1.5rem; opacity: 0.4; margin-bottom: 0.5rem;"></i><p>Lobiler yüklenirken bir hata oluştu.</p></div>';
    });
}

if (browseLobbiesBtn) {
  browseLobbiesBtn.addEventListener('click', () => {
    if (lobbiesModalOverlay) lobbiesModalOverlay.classList.add('active');
    fetchAndRenderLobbies();
  });
}

if (closeLobbiesModal) {
  closeLobbiesModal.addEventListener('click', () => {
    if (lobbiesModalOverlay) lobbiesModalOverlay.classList.remove('active');
  });
}

if (refreshLobbiesBtn) {
  refreshLobbiesBtn.addEventListener('click', fetchAndRenderLobbies);
}

// --- LOBBY PASSWORD SET AND COPY ---
const btnSetLobbyPassword = document.getElementById('btn-set-lobby-password');
if (btnSetLobbyPassword) {
  btnSetLobbyPassword.addEventListener('click', () => {
    const passwordInput = document.getElementById('lobby-set-password-input');
    const password = passwordInput ? passwordInput.value.trim() : '';
    if (socket) {
      socket.emit('updateRoomPassword', { password });
      alert("Oda şifresi güncellendi.");
    }
  });
}

if (copyLobbyPasswordBtn) {
  copyLobbyPasswordBtn.addEventListener('click', () => {
    const passwordInput = document.getElementById('lobby-set-password-input');
    if (passwordInput && passwordInput.value && !passwordInput.disabled) {
      navigator.clipboard.writeText(passwordInput.value)
        .then(() => alert("Şifre kopyalandı!"))
        .catch(err => console.error("Kopyalama hatası:", err));
    }
  });
}

// --- LOBBY ROLE SELECTIONS ---
document.querySelectorAll('.select-role-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const button = e.currentTarget;
    const team = button.dataset.team;
    const role = button.dataset.role;

    if (socket) {
      socket.emit('selectTeamRole', { team, role });
    }
  });
});

if (startGameBtn) {
  startGameBtn.addEventListener('click', () => {
    if (socket) socket.emit('startGame');
  });
}

if (testModeBtn) {
  testModeBtn.addEventListener('click', () => {
    if (socket) socket.emit('startTestMode');
  });
}

if (toggleReadyBtn) {
  toggleReadyBtn.addEventListener('click', () => {
    if (socket) socket.emit('toggleReady');
  });
}

leaveRoomBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    stopTimer();
    clearSavedSession();
    if (socket) {
      socket.emit('leaveRoom');
      socket.disconnect();
      socket.connect();
    }
    switchScreen(screenLanding);
  });
});

if (copyCodeBtn) {
  copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(activeRoomCode).then(() => {
      alert("Lobi kodu panoya kopyalandı: " + activeRoomCode);
    });
  });
}

if (shareRoomBtn) {
  shareRoomBtn.addEventListener('click', () => {
    const shareText = `🕵️ IOWFNAMES\nBir oyun lobesine davet edildin.\n🔑 Lobi Kodu: ${activeRoomCode}\n🌐 ${window.location.origin}/${activeRoomCode}`;
    navigator.clipboard.writeText(shareText).then(() => {
      alert("Lobi davet mesajı panoya kopyalandı!");
    });
  });
}


// Settings changes
if (turnDurationSelect) {
  turnDurationSelect.addEventListener('change', () => {
    const val = turnDurationSelect.value;
    if (socket) socket.emit('updateSettings', { turnDuration: val });
  });
}

if (maxPlayersSelect) {
  maxPlayersSelect.addEventListener('change', () => {
    const val = maxPlayersSelect.value;
    if (socket) socket.emit('updateSettings', { maxPlayers: val });
  });
}

if (wordPoolSelect) {
  wordPoolSelect.addEventListener('change', () => {
    const val = wordPoolSelect.value;
    if (socket) socket.emit('updateSettings', { wordPool: val });
  });
}

if (shuffleTeamsBtn) {
  shuffleTeamsBtn.addEventListener('click', () => {
    if (socket) socket.emit('shuffleTeams');
  });
}



// Edit team name buttons in lobby
const btnEditRedTeam = document.getElementById('btn-edit-red-team');
if (btnEditRedTeam) {
  btnEditRedTeam.addEventListener('click', () => {
    console.log("[DEBUG] btnEditRedTeam clicked");
    const redTextEl = document.getElementById('lobby-red-team-name-text');
    if (!redTextEl || redTextEl.querySelector('input')) return;

    const currentName = redTextEl.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.maxLength = 20;
    input.className = 'lobby-team-name-edit-input';

    redTextEl.innerHTML = '';
    redTextEl.appendChild(input);
    input.focus();

    const saveName = () => {
      const name = input.value.trim() || "KIRMIZI TAKIM";
      redTextEl.textContent = name;
      console.log("[DEBUG] Emitting updateTeamName red:", name);
      if (socket) socket.emit('updateTeamName', { team: 'red', name });
    };

    input.addEventListener('blur', saveName);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') input.blur();
    });
  });
}

const btnEditBlueTeam = document.getElementById('btn-edit-blue-team');
if (btnEditBlueTeam) {
  btnEditBlueTeam.addEventListener('click', () => {
    console.log("[DEBUG] btnEditBlueTeam clicked");
    const blueTextEl = document.getElementById('lobby-blue-team-name-text');
    if (!blueTextEl || blueTextEl.querySelector('input')) return;

    const currentName = blueTextEl.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.maxLength = 20;
    input.className = 'lobby-team-name-edit-input';

    blueTextEl.innerHTML = '';
    blueTextEl.appendChild(input);
    input.focus();

    const saveName = () => {
      const name = input.value.trim() || "MAVİ TAKIM";
      blueTextEl.textContent = name;
      console.log("[DEBUG] Emitting updateTeamName blue:", name);
      if (socket) socket.emit('updateTeamName', { team: 'blue', name });
    };

    input.addEventListener('blur', saveName);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') input.blur();
    });
  });
}

// --- LOBBY TABS TOGGLE ---
if (tabChatBtn && tabPlayersBtn) {
  tabChatBtn.addEventListener('click', () => {
    tabChatBtn.classList.add('active');
    tabPlayersBtn.classList.remove('active');
    if (chatTabContent) chatTabContent.classList.add('active');
    if (playersTabContent) playersTabContent.classList.remove('active');
  });

  tabPlayersBtn.addEventListener('click', () => {
    tabPlayersBtn.classList.add('active');
    tabChatBtn.classList.remove('active');
    if (playersTabContent) playersTabContent.classList.add('active');
    if (chatTabContent) chatTabContent.classList.remove('active');
  });
}

// Chat Form submit (Lobby)
if (lobbyChatForm) {
  lobbyChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = lobbyChatInput ? lobbyChatInput.value.trim() : '';
    if (!text) return;

    if (socket) {
      socket.emit('sendChat', { text });
    }
    if (lobbyChatInput) lobbyChatInput.value = '';
  });
}

// Chat Tabs and active state tracking
let activeChatTab = 'genel';
const tabGenel = document.getElementById('tab-genel');
const tabLider = document.getElementById('tab-lider');

if (tabGenel && tabLider) {
  tabGenel.addEventListener('click', () => {
    activeChatTab = 'genel';
    tabGenel.classList.add('active');
    tabLider.classList.remove('active');
    if (gameChatBox) gameChatBox.style.display = 'flex';
    if (leaderChatBox) leaderChatBox.style.display = 'none';
    if (gameChatBox) gameChatBox.scrollTop = gameChatBox.scrollHeight;
  });

  tabLider.addEventListener('click', () => {
    activeChatTab = 'lider';
    tabLider.classList.add('active');
    tabGenel.classList.remove('active');
    if (leaderChatBox) leaderChatBox.style.display = 'flex';
    if (gameChatBox) gameChatBox.style.display = 'none';
    if (leaderChatBox) leaderChatBox.scrollTop = leaderChatBox.scrollHeight;
  });
}

// Chat Form submit (Game screen)
const gameChatForm = document.getElementById('game-chat-form');
const gameChatInput = document.getElementById('game-chat-input');
if (gameChatForm) {
  gameChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = gameChatInput ? gameChatInput.value.trim() : '';
    if (!text) return;

    if (socket) {
      if (activeChatTab === 'lider') {
        socket.emit('sendLeaderChat', { text });
      } else {
        socket.emit('sendChat', { text });
      }
    }
    if (gameChatInput) gameChatInput.value = '';
  });
}

function appendChatBubble(msg, type = 'genel') {
  const isMe = msg.sender === myPlayerInfo.name;

  if (type === 'genel') {
    // Append to lobby chat if present
    if (lobbyChatBox) {
      const bubbleLobby = document.createElement('div');
      bubbleLobby.className = `chat-bubble ${isMe ? 'my-msg' : ''} ${msg.team}-msg`;
      bubbleLobby.innerHTML = `
        <span class="chat-sender text-${msg.team}">${escapeHTML(msg.sender)}</span>
        <span class="chat-text">${escapeHTML(msg.text)}</span>
        <span class="chat-time">${msg.time}</span>
      `;
      lobbyChatBox.appendChild(bubbleLobby);
      lobbyChatBox.scrollTop = lobbyChatBox.scrollHeight;
    }

    // Append to game chat if present
    if (gameChatBox) {
      const bubbleGame = document.createElement('div');
      bubbleGame.className = `chat-bubble ${isMe ? 'my-msg' : ''} ${msg.team}-msg`;
      bubbleGame.innerHTML = `
        <span class="chat-sender text-${msg.team}">${escapeHTML(msg.sender)}</span>
        <span class="chat-text">${escapeHTML(msg.text)}</span>
        <span class="chat-time">${msg.time}</span>
      `;
      gameChatBox.appendChild(bubbleGame);
      gameChatBox.scrollTop = gameChatBox.scrollHeight;
    }
  } else if (type === 'lider') {
    if (leaderChatBox) {
      const bubbleLeader = document.createElement('div');
      bubbleLeader.className = `chat-bubble ${isMe ? 'my-msg' : ''} ${msg.team}-msg leader-exclusive`;
      bubbleLeader.innerHTML = `
        <span class="chat-sender text-${msg.team}">👑 ${escapeHTML(msg.sender)}</span>
        <span class="chat-text">${escapeHTML(msg.text)}</span>
        <span class="chat-time">${msg.time}</span>
      `;
      leaderChatBox.appendChild(bubbleLeader);
      leaderChatBox.scrollTop = leaderChatBox.scrollHeight;
    }
  }
}



// --- ADMIN PLAYERS MANAGEMENT PANEL ---
function renderLobbyPlayersAdminList(players) {
  if (!adminPlayersBox) return;
  adminPlayersBox.innerHTML = '';
  safeSetText(playerCountLobby, players.length);

  const isAdmin = socket && socket.id === roomAdminId;

  players.forEach(p => {
    const row = document.createElement('div');
    const autoGlowClass = p.team === 'red' ? 'glow-red' : (p.team === 'blue' ? 'glow-blue' : 'glow-gray');
    row.className = `lobby-user-row ${p.playerId === localPlayerId ? 'me' : ''} ${autoGlowClass}`;
    row.setAttribute('data-player-row-id', p.id);

    let teamName = p.team === 'red' ? 'Kırmızı' : p.team === 'blue' ? 'Mavi' : 'Gözcü';
    let roleName = p.role === 'spymaster' ? 'Lider' : 'Ekip';

    let actionHTML = '';
    if (isAdmin && p.id !== socket.id && !p.isBot) {
      actionHTML = `
        <div class="lobby-user-actions">
          <button class="admin-action-btn promote" onclick="handleAdminTransfer('${p.id}')" title="Liderliği Devret"><i class="fa-solid fa-crown"></i> Lider Yap</button>
          <button class="admin-action-btn promote" onclick="handleMakeSpectator('${p.id}')" title="Gözcü Yap"><i class="fa-solid fa-eye"></i> Gözcü</button>
          <button class="admin-action-btn kick" onclick="handleKick('${p.id}')" title="Odadan At"><i class="fa-solid fa-user-minus"></i> At</button>
          <button class="admin-action-btn ban" onclick="handleBan('${p.id}')" title="Yasakla"><i class="fa-solid fa-ban"></i> Engelle</button>
        </div>
      `;
    }

    row.innerHTML = `
      <div class="lobby-user-details">
        <i class="fa-solid ${p.role === 'spymaster' ? 'fa-user-tie' : 'fa-shield-halved'} text-${p.team}"></i>
        <span><strong>${escapeHTML(p.name)}</strong> ${p.isHost ? '<span class="host-badge"><i class="fa-solid fa-crown"></i> HOST</span>' : ''} (${teamName} ${roleName})</span>
        ${!p.connected ? '<span class="offline-badge">(Bağlantı Koptu)</span>' : ''}
      </div>
      ${actionHTML}
    `;

    adminPlayersBox.appendChild(row);
  });
}

// Global window mappings
window.handleAdminTransfer = function (playerId) {
  if (confirm("Lobi liderliğini bu oyuncuya devretmek istiyor musunuz?")) {
    if (socket) socket.emit('transferAdmin', { playerId });
  }
};

window.handleMakeSpectator = function (playerId) {
  if (socket) socket.emit('makeSpectator', { playerId });
};

window.handleKick = function (playerId) {
  if (confirm("Bu oyuncuyu odadan atmak istiyor musunuz?")) {
    if (socket) socket.emit('kickPlayer', { playerId });
  }
};

window.handleBan = function (playerId) {
  if (confirm("Bu oyuncuyu odadan kalıcı olarak yasaklamak istiyor musunuz?")) {
    if (socket) socket.emit('banPlayer', { playerId });
  }
};

// --- GAMEPLAY INPUTS ---
if (btnCountDec) {
  btnCountDec.addEventListener('click', () => {
    let val = parseInt(inputClueCount.value);
    if (val > 0) safeSetValue(inputClueCount, val - 1);
  });
}

if (btnCountInc) {
  btnCountInc.addEventListener('click', () => {
    let val = parseInt(inputClueCount.value);
    if (val < 25) safeSetValue(inputClueCount, val + 1);
  });
}

if (inputClueWord) {
  inputClueWord.addEventListener('input', () => {
    // Only allow letters (including Turkish characters and accented ones), strip out numbers and symbols
    inputClueWord.value = inputClueWord.value.replace(/[^a-zA-ZçÇğĞıİöÖşŞüÜâÂîÎûÛIı]/g, '');
  });
}

if (clueForm) {
  clueForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const word = inputClueWord ? inputClueWord.value.trim().toUpperCase() : '';
    const count = parseInt(inputClueCount ? inputClueCount.value : '1');

    if (!word) {
      alert("İpucu boş olamaz.");
      return;
    }

    // Double check with regex on submit
    if (/[^A-ZÇĞİÖŞÜÂÎÛIı]/.test(word)) {
      alert("İpucu sadece harflerden oluşmalıdır. Sayı veya sembol içeremez.");
      return;
    }

    if (socket) {
      socket.emit('submitClue', { clueWord: word, clueCount: count });
    }

    if (inputClueWord) inputClueWord.value = '';
    if (inputClueCount) inputClueCount.value = '1';
  });
}

if (btnPassTurn) {
  btnPassTurn.addEventListener('click', () => {
    if (socket) socket.emit('endTurn');
  });
}

if (btnRestartGame) {
  btnRestartGame.addEventListener('click', () => {
    if (socket) socket.emit('restartGame');
  });
}

if (btnResetLobby) {
  btnResetLobby.addEventListener('click', () => {
    if (socket) socket.emit('resetToLobby');
  });
}

if (btnGameoverRestart) {
  btnGameoverRestart.addEventListener('click', () => {
    if (gameoverModal) gameoverModal.classList.remove('active');
    if (socket) socket.emit('restartGame');
  });
}

if (btnGameoverLobby) {
  btnGameoverLobby.addEventListener('click', () => {
    if (gameoverModal) gameoverModal.classList.remove('active');
    if (socket) socket.emit('resetToLobby');
  });
}

if (btnGameoverClose) {
  btnGameoverClose.addEventListener('click', () => {
    winnerModalDismissed = true;
    if (gameoverModal) gameoverModal.classList.remove('active');
  });
}

// Team Name blur listeners
if (redTeamNameInput) {
  redTeamNameInput.addEventListener('blur', () => {
    const name = redTeamNameInput.value.trim() || "KIRMIZI TAKIM";
    if (socket) socket.emit('updateTeamName', { team: 'red', name });
  });

  redTeamNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') redTeamNameInput.blur();
  });
}

if (blueTeamNameInput) {
  blueTeamNameInput.addEventListener('blur', () => {
    const name = blueTeamNameInput.value.trim() || "MAVİ TAKIM";
    if (socket) socket.emit('updateTeamName', { team: 'blue', name });
  });

  blueTeamNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') blueTeamNameInput.blur();
  });
}

// --- LOBBY LISTINGS RENDERING ---
function renderLobbyPlayers(players) {
  if (!lobbyRedSpymaster || !lobbyRedAgents || !lobbyBlueSpymaster || !lobbyBlueAgents || !spectatorList) return;

  lobbyRedSpymaster.innerHTML = '';
  lobbyRedAgents.innerHTML = '';
  lobbyBlueSpymaster.innerHTML = '';
  lobbyBlueAgents.innerHTML = '';
  spectatorList.innerHTML = '';

  players.forEach(p => {
    const div = document.createElement('div');
    const autoGlowClass = p.team === 'red' ? 'glow-red' : (p.team === 'blue' ? 'glow-blue' : 'glow-gray');
    div.className = `player-item team-${p.team} ${p.playerId === localPlayerId ? 'me' : ''} ${autoGlowClass}`;
    div.setAttribute('data-player-row-id', p.id);

    let nameClass = '';
    if (p.role === 'spymaster') {
      nameClass = 'leader-name-gold';
    } else if (p.team === 'red') {
      nameClass = 'name-red';
    } else if (p.team === 'blue') {
      nameClass = 'name-blue';
    } else {
      nameClass = 'name-gray';
    }

    let html = `<div class="player-name-wrap">
                  <span class="role-emoji">${p.role === 'spymaster' ? '👑' : p.team === 'spectator' ? '👀' : '👤'}</span>
                  <span class="${nameClass}">${escapeHTML(p.name)}</span>
                  ${p.isHost ? `<span class="host-badge"><i class="fa-solid fa-crown"></i> HOST</span>` : ''}
                  <span class="player-emoji-slot">${p.emoji ? `<span class="emoji-reaction-bubble">${p.emoji}</span>` : ''}</span>
                </div>`;

    // Add Ready badge for all team players (including host)
    if (p.team !== 'spectator') {
      if (p.ready) {
        html += `<span class="ready-badge ready"><i class="fa-solid fa-circle-check"></i> Hazır</span>`;
      } else {
        html += `<span class="ready-badge not-ready"><i class="fa-solid fa-circle-xmark"></i> Hazır Değil</span>`;
      }
    }

    if (!p.connected) {
      html += `<span class="offline-badge">(Bağlantı Koptu)</span>`;
    }

    div.innerHTML = html;

    if (p.team === 'red') {
      if (p.role === 'spymaster') lobbyRedSpymaster.appendChild(div);
      else lobbyRedAgents.appendChild(div);
    } else if (p.team === 'blue') {
      if (p.role === 'spymaster') lobbyBlueSpymaster.appendChild(div);
      else lobbyBlueAgents.appendChild(div);
    } else {
      spectatorList.appendChild(div);
    }
  });

  // Fallback empty cards
  if (!lobbyRedSpymaster.children.length) lobbyRedSpymaster.innerHTML = '<div class="empty-state">Lider Yok</div>';
  if (!lobbyRedAgents.children.length) lobbyRedAgents.innerHTML = '<div class="empty-state">Ekip Yok</div>';
  if (!lobbyBlueSpymaster.children.length) lobbyBlueSpymaster.innerHTML = '<div class="empty-state">Lider Yok</div>';
  if (!lobbyBlueAgents.children.length) lobbyBlueAgents.innerHTML = '<div class="empty-state">Ekip Yok</div>';
  if (!spectatorList.children.length) spectatorList.innerHTML = '<div class="empty-state">Gözcü Yok</div>';
}

// --- GAMEPLAY SCREEN RENDERER ---
function renderGame(gameState, playersList, roomSettings) {
  const turn = gameState.currentTurn;

  // Sync background color based on active team turn
  const glowBgEl = document.querySelector('.glow-bg');
  if (glowBgEl) {
    if (turn.team === 'red') {
      glowBgEl.classList.add('turn-red');
      glowBgEl.classList.remove('turn-blue');
    } else if (turn.team === 'blue') {
      glowBgEl.classList.add('turn-blue');
      glowBgEl.classList.remove('turn-red');
    }
  }

  // Sync turn direction arrows next to timer
  const arrowLeft = document.getElementById('turn-arrow-left');
  const arrowRight = document.getElementById('turn-arrow-right');
  if (arrowLeft && arrowRight) {
    if (turn.team === 'red') {
      arrowLeft.style.display = 'flex';
      arrowRight.style.display = 'none';
    } else if (turn.team === 'blue') {
      arrowLeft.style.display = 'none';
      arrowRight.style.display = 'flex';
    } else {
      arrowLeft.style.display = 'none';
      arrowRight.style.display = 'none';
    }
  }

  // Turn Change Audio Feedback
  if (lastTurnTeam !== turn.team || lastTurnRole !== turn.role) {
    const isFirstRun = lastTurnTeam === '';
    lastTurnTeam = turn.team;
    lastTurnRole = turn.role;

    if (!isFirstRun) {
      const isMyTurn = myPlayerInfo.team === turn.team && myPlayerInfo.role === turn.role;
      if (isMyTurn) {
        playLocalSound('turn-change-my');
      } else {
        playLocalSound('turn-change-other');
      }
    }
  }

  const isMyTeamTurn = myPlayerInfo.team === turn.team;
  const isMyRole = myPlayerInfo.role === turn.role;
  const isAgent = myPlayerInfo.role === 'agent';
  const isSpymaster = myPlayerInfo.role === 'spymaster';

  // Sync turn indicator, winner status and timer display in the top bar
  const turnTeamName = document.getElementById('turn-team-name');
  const turnStatusText = document.getElementById('turn-status-text');
  const timerWrap = document.getElementById('topbar-timer-wrap');

  if (turnTeamName) {
    if (gameState.winner) {
      const winnerTeamDisplayName = gameState.winner === 'red'
        ? (gameState.teamNames ? gameState.teamNames.red : 'KIRMIZI TAKIM')
        : (gameState.teamNames ? gameState.teamNames.blue : 'MAVİ TAKIM');

      const teamSpan = gameState.winner === 'red'
        ? `<span class="text-red font-bold">${escapeHTML(winnerTeamDisplayName)}</span>`
        : `<span class="text-blue font-bold">${escapeHTML(winnerTeamDisplayName)}</span>`;

      turnStatusText.innerHTML = `${teamSpan} OYUNU KAZANDI! 🏆`;
      turnTeamName.textContent = '🏆';

      const turnIndicator = document.getElementById('turn-indicator');
      if (turnIndicator) {
        turnIndicator.className = `turn-indicator ${gameState.winner}`;
      }

      // Hide timer on game over
      if (timerWrap) timerWrap.style.display = 'none';
    } else {
      const turnTeamDisplayName = turn.team === 'red'
        ? (gameState.teamNames ? gameState.teamNames.red : 'KIRMIZI TAKIM')
        : (gameState.teamNames ? gameState.teamNames.blue : 'MAVİ TAKIM');

      const teamSpan = turn.team === 'red'
        ? `<span class="text-red">${escapeHTML(turnTeamDisplayName)}</span>`
        : `<span class="text-blue">${escapeHTML(turnTeamDisplayName)}</span>`;

      if (turn.role === 'spymaster') {
        turnStatusText.innerHTML = `${teamSpan} Lideri düşünüyor`;
        turnTeamName.textContent = '🤔';
      } else {
        turnStatusText.innerHTML = `${teamSpan} Ekibi seçiyor`;
        turnTeamName.textContent = '🎯';
      }

      const turnIndicator = document.getElementById('turn-indicator');
      if (turnIndicator) {
        turnIndicator.className = `turn-indicator ${turn.team}`;
      }

      // Show timer during active play
      if (timerWrap) timerWrap.style.display = 'flex';
    }
  }

  syncRoomCodeDisplay();

  // 1. Sync custom team names
  if (gameState.teamNames) {
    if (redTeamNameInput && document.activeElement !== redTeamNameInput) {
      redTeamNameInput.value = gameState.teamNames.red;
    }
    if (blueTeamNameInput && document.activeElement !== blueTeamNameInput) {
      blueTeamNameInput.value = gameState.teamNames.blue;
    }
  }

  // 2. Score counts
  safeSetText(redScoreVal, gameState.scores.red);
  safeSetText(blueScoreVal, gameState.scores.blue);

  // 3. Render top-row active players displays
  if (gameRedSpymaster && gameRedAgents && gameBlueSpymaster && gameBlueAgents) {
    gameRedSpymaster.innerHTML = '';
    gameRedAgents.innerHTML = '';
    gameBlueSpymaster.innerHTML = '';
    gameBlueAgents.innerHTML = '';

    const redSpy = playersList.find(p => p.team === 'red' && p.role === 'spymaster');
    if (redSpy) {
      const redSpyEmojiHTML = redSpy.emoji ? `<span class="emoji-reaction-bubble">${redSpy.emoji}</span>` : '';
      gameRedSpymaster.innerHTML = `<span class="spymaster-badge glow-red" data-player-row-id="${redSpy.id}">👑 <span class="leader-name-gold">${escapeHTML(redSpy.name)}</span> <span class="player-emoji-slot">${redSpyEmojiHTML}</span></span>`;
    } else {
      gameRedSpymaster.innerHTML = `<span class="spymaster-badge text-muted">👑 Lider Yok</span>`;
    }

    const blueSpy = playersList.find(p => p.team === 'blue' && p.role === 'spymaster');
    if (blueSpy) {
      const blueSpyEmojiHTML = blueSpy.emoji ? `<span class="emoji-reaction-bubble">${blueSpy.emoji}</span>` : '';
      gameBlueSpymaster.innerHTML = `<span class="spymaster-badge glow-blue" data-player-row-id="${blueSpy.id}">👑 <span class="leader-name-gold">${escapeHTML(blueSpy.name)}</span> <span class="player-emoji-slot">${blueSpyEmojiHTML}</span></span>`;
    } else {
      gameBlueSpymaster.innerHTML = `<span class="spymaster-badge text-muted">👑 Lider Yok</span>`;
    }

    playersList.filter(p => p.team === 'red' && p.role === 'agent').forEach(p => {
      const span = document.createElement('span');
      span.className = `agent-tag ${p.playerId === localPlayerId ? 'is-me' : ''} glow-red`;
      span.setAttribute('data-player-row-id', p.id);
      const emojiHTML = p.emoji ? `<span class="emoji-reaction-bubble">${p.emoji}</span>` : '';
      span.innerHTML = `👤 ${escapeHTML(p.name)} <span class="player-emoji-slot">${emojiHTML}</span>`;
      gameRedAgents.appendChild(span);
    });

    playersList.filter(p => p.team === 'blue' && p.role === 'agent').forEach(p => {
      const span = document.createElement('span');
      span.className = `agent-tag ${p.playerId === localPlayerId ? 'is-me' : ''} glow-blue`;
      span.setAttribute('data-player-row-id', p.id);
      const emojiHTML = p.emoji ? `<span class="emoji-reaction-bubble">${p.emoji}</span>` : '';
      span.innerHTML = `👤 ${escapeHTML(p.name)} <span class="player-emoji-slot">${emojiHTML}</span>`;
      gameBlueAgents.appendChild(span);
    });
  }

  // Sync leader chat tab visibility
  const tabLiderEl = document.getElementById('tab-lider');
  if (tabLiderEl) {
    if (isSpymaster) {
      tabLiderEl.style.display = 'flex';
    } else {
      tabLiderEl.style.display = 'none';
      if (activeChatTab === 'lider') {
        const tabGenelEl = document.getElementById('tab-genel');
        if (tabGenelEl) tabGenelEl.click();
      }
    }
  }

  // 4. View constraints
  const isSpymasterView = isSpymaster;

  // 5. Clues bar sync
  let showClueInput = false;
  let showClueDisplay = false;
  let showPassBtn = false;

  if (turn.role === 'spymaster') {
    if (isMyTeamTurn && isSpymaster) {
      showClueInput = true;
    } else {
      showClueDisplay = true;
      safeSetText(displayClueWord, "-----");
      safeSetText(displayClueCount, "-");
      const teamText = turn.team === 'red' ? (gameState.teamNames ? gameState.teamNames.red : 'Kırmızı') : (gameState.teamNames ? gameState.teamNames.blue : 'Mavi');
      safeSetText(displayRemainingGuesses, `(${teamText} Lider ipucu veriyor)`);
    }
  } else {
    showClueDisplay = true;
    if (turn.clue) {
      safeSetText(displayClueWord, turn.clue.word);
      safeSetText(displayClueCount, turn.clue.count === 0 ? "∞" : turn.clue.count);
      safeSetText(displayRemainingGuesses, `(Kalan Tahmin Hakları: ${turn.clue.remainingGuesses})`);

      // Detect NEW clue and show popup
      const newClueKey = `${turn.team}-${turn.clue.word}-${turn.clue.count}`;
      if (newClueKey !== lastClueKey) {
        lastClueKey = newClueKey;
        showCluePopup(turn.clue.word, turn.clue.count === 0 ? "∞" : turn.clue.count, turn.team);
      }
    } else {
      safeSetText(displayClueWord, "-----");
      safeSetText(displayClueCount, "-");
      safeSetText(displayRemainingGuesses, '');
    }

    if (isMyTeamTurn && isAgent) {
      showPassBtn = true;
    }
  }

  safeSetDisplay(clueInputMode, showClueInput ? 'block' : 'none');
  safeSetDisplay(clueDisplayMode, showClueDisplay ? 'flex' : 'none');
  safeSetDisplay(btnPassTurn, showPassBtn ? 'block' : 'none');

  // 6. Active Timer local sync
  const durationType = roomSettings ? roomSettings.turnDuration : 90;
  if (durationType === 'unlimited') {
    isUnlimitedTimer = true;
    safeSetText(timerNum, "SINIRSIZ");
    if (timerBar) {
      timerBar.style.width = "100%";
      timerBar.className = "timer-progress-bar green";
    }
    stopTimer();
  } else {
    isUnlimitedTimer = false;
    const currentTurnKey = `${turn.team}-${turn.role}-${turn.clue ? turn.clue.word : 'no-clue'}`;
    if (currentTurnKey !== lastTurnStateKey) {
      lastTurnStateKey = currentTurnKey;
      const duration = parseInt(durationType);
      const titleText = turn.role === 'spymaster' ? 'Lider Süresi' : 'Ekip Süresi';
      startCountdownTimer(duration, titleText);
    }
  }

  // 7. Cards Rendering Grid (5x5)
  if (cardsGrid) {
    const existingCards = cardsGrid.children;
    const needsFullRebuild = existingCards.length !== 25;

    if (needsFullRebuild) {
      cardsGrid.innerHTML = '';
    }

    // Clear local inspection memory if no cards are revealed (e.g. game restarted)
    const revealedCount = gameState.board.filter(c => c.revealed).length;
    if (revealedCount === 0) {
      inspectedCardIndices.clear();
    }

    gameState.board.forEach((card, index) => {
      if (gameState.winner) { card.revealed = true; }
      let cardEl;
      if (needsFullRebuild) {
        cardEl = document.createElement('div');
        cardsGrid.appendChild(cardEl);
      } else {
        cardEl = existingCards[index];
      }

      cardEl.dataset.index = index;
      const isCurrentUserThinking = card.thinkingBy.includes(socket && socket.id);

      let thinkingBubblesHTML = '';
      const count = card.thinkingBy.length;
      card.thinkingBy.forEach(sid => {
        const p = playersList.find(x => x.id === sid);
        if (p) {
          const fontSizeClass = count >= 2 ? 'small-text' : '';
          thinkingBubblesHTML += `<span class="thinking-bubble ${fontSizeClass}" title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</span>`;
        }
      });

      const isMyTurnToGuess = isMyTeamTurn && isAgent && turn.role === 'agent';
      const showConfirmBtn = isMyTurnToGuess && isCurrentUserThinking && !card.revealed;

      // When the game is won/ended, reveal all cards visually so players can see colors & characters
      const isCardRevealed = card.revealed || (gameState.winner ? true : false);

      const cardStateString = JSON.stringify({
        word: card.word,
        color: card.color,
        revealed: isCardRevealed,
        stage: card.stage,
        thinkingBy: card.thinkingBy,
        showConfirmBtn: showConfirmBtn,
        isSpymasterView: isSpymasterView,
        characterImage: card.characterImage,
        characterName: card.characterName,
        clickedBy: card.clickedBy
      });

      const wasRevealed = cardEl.classList.contains('revealed');
      const isNowRevealed = isCardRevealed;
      const isNewlyRevealed = !wasRevealed && isNowRevealed;

      const isInspected = inspectedCardIndices.has(index);
      const targetClassName = `card-item color-${card.color}` +
        (isCardRevealed ? ` revealed` : '') +
        (isCardRevealed && isInspected ? ` stage2` : '') +
        (isSpymasterView ? ' is-spymaster' : '');

      if (cardEl.dataset.state !== cardStateString) {
        cardEl.dataset.state = cardStateString;

        // Build card-back HTML (character side)
        const showCover = card.characterImage && card.characterImage.trim() !== "";
        const cardBackHTML = `
              ${showCover ? `
              <div class="card-character-cover" style="background-image: url('${card.characterImage}');">
                <span class="character-name-badge">${escapeHTML(card.characterName || '')}</span>
              </div>
              ` : ''}
              <span class="card-word">${escapeHTML(card.word)}</span>`;

        // Build card-front HTML (closed side)
        const cardFrontHTML = `
              <div class="thinking-container">${thinkingBubblesHTML}</div>
              ${showConfirmBtn ? `<button class="confirm-reveal-btn" title="Kartı Aç"><i class="fa-solid fa-hand-pointer"></i> Aç</button>` : ''}
              <span class="card-word">${escapeHTML(card.word)}</span>`;

        if (isNewlyRevealed) {
          // FLIP ANIMATION: update back content first, then flip via class
          const cardInner = cardEl.querySelector('.card-inner');
          if (cardInner) {
            const cardBack = cardInner.querySelector('.card-back');
            if (cardBack) cardBack.innerHTML = cardBackHTML;
            const cardFront = cardInner.querySelector('.card-front');
            if (cardFront) cardFront.innerHTML = cardFrontHTML;
          }
          // Apply class in next frame so CSS transition triggers
          requestAnimationFrame(() => {
            cardEl.className = targetClassName;
          });
        } else {
          // Normal rebuild (no animation needed)
          cardEl.className = targetClassName;
          cardEl.innerHTML = `
            <div class="card-inner">
              <div class="card-front">
                ${cardFrontHTML}
              </div>
              
              <div class="card-back">
                ${cardBackHTML}
              </div>
            </div>
          `;
        }
      } else {
        // Only update className if it changed (no innerHTML change)
        if (cardEl.className !== targetClassName) {
          cardEl.className = targetClassName;
        }
      }

       if (cardEl._clickHandler) {
        cardEl.removeEventListener('click', cardEl._clickHandler);
      }
      cardEl._clickHandler = (e) => {
        if (e.target.closest('.confirm-reveal-btn')) {
          if (gameState.winner) return; // Block reveal action after game over
          e.stopPropagation();
          if (socket) socket.emit('confirmReveal', { cardIndex: index });
          playLocalSound('click-correct');
          return;
        }

        if (!card.revealed) {
          if (gameState.winner) return; // Block thinking action after game over
          if (isMyTurnToGuess) {
            if (socket) socket.emit('toggleThinking', { cardIndex: index });
          }
        } else {
          // Card is already revealed! Toggle Stage 2 (Inspect Word) locally (always allowed!)
          if (inspectedCardIndices.has(index)) {
            inspectedCardIndices.delete(index);
            cardEl.classList.remove('stage2');
          } else {
            inspectedCardIndices.add(index);
            cardEl.classList.add('stage2');
          }
          playLocalSound('click-correct');
        }
      };
      cardEl.addEventListener('click', cardEl._clickHandler);
    });
  }

  // 8. Sync footer role display
  let mTeamName = myPlayerInfo.team === 'red' ? (gameState.teamNames ? gameState.teamNames.red : 'Kırmızı') : myPlayerInfo.team === 'blue' ? (gameState.teamNames ? gameState.teamNames.blue : 'Mavi') : 'Gözcü';
  let mRoleName = myPlayerInfo.role === 'spymaster' ? 'Lider' : 'Ekip';
  if (myRoleDisplay) {
    if (myPlayerInfo.team === 'spectator') {
      myRoleDisplay.innerHTML = `<span class="text-gray" style="color: #9ca3af;">Gözcü</span>`;
    } else {
      const colorClass = myPlayerInfo.team === 'red' ? 'text-red' : 'text-blue';
      myRoleDisplay.innerHTML = `<span class="${colorClass}">${escapeHTML(mTeamName)}</span> ${escapeHTML(mRoleName)}`;
    }
  }

  // 9. Activity logs
  if (logMessages) {
    logMessages.innerHTML = '';
    
    // Group consecutive card clicks by the same player to save vertical space
    const groupedEntries = [];
    gameState.log.forEach(entry => {
      if (entry.text.includes('ipucu verdi:')) {
        groupedEntries.push({ type: 'clue', text: entry.text });
      } else if (entry.text.includes('kartını açtı. Sonuç:')) {
        const parts = entry.text.split(' ');
        const playerName = parts[0];
        const matchWord = entry.text.match(/"([^"]+)"/);
        const word = matchWord ? matchWord[1] : '';

        let cardColor = 'neutral';
        if (entry.text.includes('Kırmızı Ekip 🔴')) {
          cardColor = 'red';
        } else if (entry.text.includes('Mavi Ekip 🔵')) {
          cardColor = 'blue';
        } else if (entry.text.includes('Masum Sivil ⚪')) {
          cardColor = 'neutral';
        } else if (entry.text.includes('Tetikçi') || (!entry.text.includes('Masum Sivil') && !entry.text.includes('Kırmızı Ekip') && !entry.text.includes('Mavi Ekip'))) {
          cardColor = 'assassin';
        }

        const lastItem = groupedEntries[groupedEntries.length - 1];
        if (lastItem && lastItem.type === 'click' && lastItem.playerName === playerName) {
          lastItem.clicks.push({ word, cardColor });
        } else {
          groupedEntries.push({
            type: 'click',
            playerName,
            clicks: [{ word, cardColor }]
          });
        }
      } else if (entry.text.includes('sırasını savdı. Pas geçildi.')) {
        const playerName = entry.text.split(' ')[0];
        groupedEntries.push({ type: 'pass', playerName });
      } else {
        groupedEntries.push({ type: 'system', text: entry.text });
      }
    });

    // Render grouped entries
    groupedEntries.forEach(entry => {
      const entryDiv = document.createElement('div');
      let customClass = 'system';
      let formattedHTML = '';

      if (entry.type === 'clue') {
        const redTeamName = gameState.teamNames ? gameState.teamNames.red : 'Kırmızı';
        const isRed = entry.text.includes(`${redTeamName} Anlatıcı`) || entry.text.includes(redTeamName) || entry.text.includes('Kırmızı');
        const teamName = isRed
          ? (gameState.teamNames ? gameState.teamNames.red : 'KIRMIZI TAKIM')
          : (gameState.teamNames ? gameState.teamNames.blue : 'MAVİ TAKIM');

        const matchWord = entry.text.match(/"([^"]+)"/);
        let clueText = matchWord ? matchWord[1] : '';
        
        // Wrap count in parenthesis if formatted as "WORD COUNT"
        const parts = clueText.split(' ');
        if (parts.length === 2 && !parts[1].startsWith('(')) {
          clueText = `${parts[0]} (${parts[1]})`;
        }
        
        customClass = isRed ? 'red-clue' : 'blue-clue';
        formattedHTML = `<span class="log-icon">💡</span> <strong style="text-transform: uppercase;">${teamName}</strong> İpucu: <span class="clue-highlight">${clueText}</span>`;
      }
      else if (entry.type === 'click') {
        customClass = 'compact-click-group';
        let badgesHTML = '';
        entry.clicks.forEach(click => {
          badgesHTML += `<span class="log-word-badge ${click.cardColor}-badge">${escapeHTML(click.word)}</span>`;
        });
        formattedHTML = `<span class="log-icon">👤</span> <strong class="player-name">${escapeHTML(entry.playerName)}</strong> ➔ ${badgesHTML}`;
      }
      else if (entry.type === 'pass') {
        customClass = 'system';
        formattedHTML = `<span class="log-icon">🔄</span> <strong class="player-name">${escapeHTML(entry.playerName)}</strong> turu sonlandırdı`;
      }
      else {
        customClass = 'system';
        formattedHTML = escapeHTML(entry.text);
      }

      entryDiv.className = `log-entry ${customClass}`;
      entryDiv.innerHTML = `<span class="log-text">${formattedHTML}</span>`;
      logMessages.appendChild(entryDiv);
    });

    logMessages.scrollTop = logMessages.scrollHeight;
  }

  // 10. Gameover modal overlay
  if (gameState.winner) {
    const wTeamName = gameState.winner === 'red'
      ? (gameState.teamNames ? gameState.teamNames.red : 'KIRMIZI TAKIM')
      : (gameState.teamNames ? gameState.teamNames.blue : 'MAVİ TAKIM');

    if (winnerTeamText) {
      winnerTeamText.textContent = `ZAFER ${wTeamName}!`;
      winnerTeamText.className = `text-${gameState.winner}`;
    }
    safeSetText(winnerReasonText, `${wTeamName} tüm kelimeleri bularak oyunu kazandı!`);

    const isAdmin = socket.id === roomAdminId;
    safeSetDisplay(btnGameoverRestart, isAdmin ? 'block' : 'none');
    safeSetDisplay(btnGameoverLobby, isAdmin ? 'block' : 'none');
    safeSetDisplay(btnGameoverClose, 'block');

    if (gameoverModal && !gameoverModal.classList.contains('active') && !winnerModalDismissed) {
      playLocalSound('victory');
      gameoverModal.classList.add('active');
    }
    stopTimer();
  } else {
    winnerModalDismissed = false; // Reset dismiss flag when game resets
    if (gameoverModal) gameoverModal.classList.remove('active');
  }
}

// --- TIMER CONTROLLER ---
function startCountdownTimer(seconds, title) {
  stopTimer();
  timerSecondsRemaining = seconds;
  safeSetText(timerTitleText, title);
  updateTimerUI(seconds, seconds);

  timerInterval = setInterval(() => {
    timerSecondsRemaining--;
    updateTimerUI(timerSecondsRemaining, seconds);

    if (timerSecondsRemaining <= 0) {
      stopTimer();
      safeSetText(timerNum, "SÜRE DOLDU");
    }
  }, 1000);
}

function updateTimerUI(remaining, total) {
  if (!timerNum || !timerBar) return;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  timerNum.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;

  const pct = (remaining / total) * 100;
  timerBar.style.width = `${pct}%`;
  timerBar.className = "timer-progress-bar";
  if (pct > 50) timerBar.classList.add('green');
  else if (pct > 20) timerBar.classList.add('orange');
  else timerBar.classList.add('red');
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// --- RULES MODAL EVENTS ---
if (rulesBtn) {
  rulesBtn.addEventListener('click', () => {
    if (rulesModal) rulesModal.classList.add('active');
  });
}

if (closeRulesBtn) {
  closeRulesBtn.addEventListener('click', () => {
    if (rulesModal) rulesModal.classList.remove('active');
  });
}

// Close modal on overlay click (outside the content)
if (rulesModal) {
  rulesModal.addEventListener('click', (e) => {
    if (e.target === rulesModal) {
      rulesModal.classList.remove('active');
    }
  });
}

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (rulesModal) rulesModal.classList.remove('active');
    if (gameoverModal) gameoverModal.classList.remove('active');
  }
});

// --- GAME & LOBBY TOPBAR ROOM CODE ACTIONS ---
function syncRoomCodeDisplay() {
  const displayRoomCodeEl = document.getElementById('display-room-code');
  const gameRoomCodeValEl = document.getElementById('game-room-code-val');
  const btnToggleLobbyCode = document.getElementById('btn-toggle-lobby-code');
  const btnToggleRoomCode = document.getElementById('btn-toggle-room-code');
  
  const displayLobbyPwContainer = document.getElementById('display-lobby-password-container');
  const displayLobbyPwVal = document.getElementById('display-lobby-password');

  const visibleText = activeRoomCode || '------';
  const hiddenText = '******'; // Star mask as requested by user

  if (roomCodeHidden) {
    if (displayRoomCodeEl) displayRoomCodeEl.textContent = hiddenText;
    if (gameRoomCodeValEl) gameRoomCodeValEl.textContent = hiddenText;
    if (btnToggleLobbyCode) btnToggleLobbyCode.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    if (btnToggleRoomCode) btnToggleRoomCode.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    
    // Hide password details
    if (displayLobbyPwVal) displayLobbyPwVal.textContent = '***';
  } else {
    if (displayRoomCodeEl) displayRoomCodeEl.textContent = visibleText;
    if (gameRoomCodeValEl) gameRoomCodeValEl.textContent = visibleText;
    if (btnToggleLobbyCode) btnToggleLobbyCode.innerHTML = '<i class="fa-solid fa-eye"></i>';
    if (btnToggleRoomCode) btnToggleRoomCode.innerHTML = '<i class="fa-solid fa-eye"></i>';

    // Show password details
    if (displayLobbyPwVal) displayLobbyPwVal.textContent = activeRoomPassword || '---';
  }

  // Show/Hide password container based on whether a password exists
  if (displayLobbyPwContainer) {
    displayLobbyPwContainer.style.display = (activeRoomPassword && activeRoomPassword !== "") ? 'inline-flex' : 'none';
  }
}

const btnToggleRoomCode = document.getElementById('btn-toggle-room-code');
if (btnToggleRoomCode) {
  btnToggleRoomCode.addEventListener('click', () => {
    roomCodeHidden = !roomCodeHidden;
    syncRoomCodeDisplay();
  });
}

const btnToggleLobbyCode = document.getElementById('btn-toggle-lobby-code');
if (btnToggleLobbyCode) {
  btnToggleLobbyCode.addEventListener('click', () => {
    roomCodeHidden = !roomCodeHidden;
    syncRoomCodeDisplay();
  });
}

const btnCopyGameCode = document.getElementById('btn-copy-game-code');
if (btnCopyGameCode) {
  btnCopyGameCode.addEventListener('click', () => {
    navigator.clipboard.writeText(activeRoomCode).then(() => {
      alert("Oda kodu panoya kopyalandı: " + activeRoomCode);
    });
  });
}

const btnToggleSound = document.getElementById('btn-toggle-sound');
if (btnToggleSound) {
  btnToggleSound.addEventListener('click', () => {
    soundMuted = !soundMuted;
    if (soundMuted) {
      btnToggleSound.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
      btnToggleSound.classList.add('muted');
    } else {
      btnToggleSound.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      btnToggleSound.classList.remove('muted');
    }
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Auto join link parameter
window.addEventListener('DOMContentLoaded', () => {
  // Preload all high-res character images in the background for zero-lag rendering
  preloadCharacterImages();

  // Logo home button action
  const brandHomeBtn = document.getElementById('brand-home-btn');
  if (brandHomeBtn) {
    brandHomeBtn.addEventListener('click', () => {
      if (socket) {
        socket.emit('leaveRoom');
      }
      clearSavedSession();
      window.location.href = window.location.origin;
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  let roomCodeQuery = urlParams.get('room');

  // If no query parameter, check pathname (e.g. /AXMBFC)
  if (!roomCodeQuery) {
    const pathCode = window.location.pathname.substring(1).toUpperCase();
    if (/^[A-Z]{3}$/.test(pathCode)) {
      roomCodeQuery = pathCode;
    }
  }

  if (roomCodeQuery && roomCodeQuery.length === 3) {
    if (roomCodeInput) roomCodeInput.value = roomCodeQuery.toUpperCase();

    // Auto-join as a guest spectator with a unique temporary name so we can render the lobby in the background
    const tempGuestName = `Katılımcı#${Math.floor(1000 + Math.random() * 9000)}`;
    if (socket) {
      socket.emit('joinRoom', { roomCode: roomCodeQuery.toUpperCase(), name: tempGuestName, playerId: localPlayerId });
    }

    // Show the guest username modal prompt overlay
    const modal = document.getElementById('username-modal-overlay');
    if (modal) {
      modal.classList.add('active');
      setTimeout(() => {
        const input = document.getElementById('modal-username-input');
        if (input) input.focus();
      }, 150);
    }
  }
});

// ============ CLUE POPUP ANIMATION ============
function showCluePopup(word, count, team) {
  // Remove any existing popup
  const existing = document.querySelector('.clue-popup-overlay');
  if (existing) existing.remove();

  const teamColor = team === 'red' ? '#ff3860' : '#00d2ff';
  const teamGlow = team === 'red' ? 'rgba(255, 56, 96, 0.6)' : 'rgba(0, 210, 255, 0.6)';
  const teamLabel = team === 'red' ? 'KIRMIZI' : 'MAVİ';

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'clue-popup-overlay';

  // Create popup card
  overlay.innerHTML = `
    <div class="clue-popup-card ${team}">
      <div class="clue-popup-label">💡 İPUCU VERİLDİ!</div>
      <div class="clue-popup-word">${escapeHTML(word.toUpperCase())}</div>
      <div class="clue-popup-count">${count}</div>
      <div class="clue-popup-team">${teamLabel} TAKIM LİDERİ</div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Trigger entrance animation (next frame)
  requestAnimationFrame(() => {
    overlay.classList.add('show');
  });

  // After 3 seconds, animate out
  setTimeout(() => {
    overlay.classList.remove('show');
    overlay.classList.add('hide');
    // Remove from DOM after exit animation
    setTimeout(() => {
      overlay.remove();
    }, 600);
  }, 3000);
}

// ============ FULLSCREEN MODE CONTROLLER ============
const fullscreenBtn = document.getElementById('fullscreen-btn');
if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
        .then(() => {
          fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i> Normal Ekran';
        })
        .catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
      document.exitFullscreen();
      fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i> Tam Ekran';
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i> Tam Ekran';
    } else {
      fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i> Normal Ekran';
    }
  });
}

// ============ FEEDBACK DRAWER CLICK CONTROLLER ============
const feedbackDrawer = document.querySelector('.feedback-drawer');
const feedbackTrigger = document.querySelector('.feedback-drawer-trigger');
if (feedbackTrigger && feedbackDrawer) {
  feedbackTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    feedbackDrawer.classList.toggle('active');
  });

  // Close the drawer if clicking anywhere else
  document.addEventListener('click', (e) => {
    if (!feedbackDrawer.contains(e.target)) {
      feedbackDrawer.classList.remove('active');
    }
  });
}

// ============ LANDING INFO PANEL TAB SWITCHER ============
const infoTabBtns = document.querySelectorAll('.info-tab-btn');
infoTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;

    // Remove active from all buttons and contents
    infoTabBtns.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.info-tab-content').forEach(c => c.classList.remove('active'));

    // Add active to current
    btn.classList.add('active');
    const targetContent = document.getElementById(`tab-${tabId}`);
    if (targetContent) targetContent.classList.add('active');
  });
});

// ============ GUEST USERNAME PROMPT MODAL ============
const usernameModalOverlay = document.getElementById('username-modal-overlay');
const modalUsernameInput = document.getElementById('modal-username-input');
const modalJoinBtn = document.getElementById('modal-join-btn');

function submitGuestUsername() {
  if (!modalUsernameInput || !modalPasswordInput) return;

  const urlParams = new URLSearchParams(window.location.search);
  let roomCodeQuery = urlParams.get('room');
  if (!roomCodeQuery) {
    const pathCode = window.location.pathname.substring(1).toUpperCase();
    if (/^[A-Z]{3}$/.test(pathCode)) {
      roomCodeQuery = pathCode;
    }
  }

  const name = modalUsernameInput.value.trim();
  const password = modalPasswordInput.value.trim();

  // If password field is active/visible, they must enter a password
  const isPasswordVisible = modalPasswordGroup && modalPasswordGroup.style.display !== 'none';

  if (isPasswordVisible && !password) {
    if (modalPasswordError) {
      modalPasswordError.textContent = "Lütfen oda şifresini girin.";
      modalPasswordError.style.display = 'block';
    }
    return;
  }

  // Determine the target room code
  const targetRoomCode = modalJoinBtn ? modalJoinBtn.getAttribute('data-target-room-code') : roomCodeQuery;

  if (isPasswordVisible) {
    // Password-protected flow
    let joinName = name;
    if (!modalUsernameGroup || modalUsernameGroup.style.display === 'none') {
      // Username group was hidden, meaning they joined from the main landing page
      joinName = usernameInput ? usernameInput.value.trim() : '';
    }

    if (!joinName) {
      alert("Lütfen geçerli bir takma ad girin.");
      return;
    }

    if (modalPasswordError) modalPasswordError.style.display = 'none';

    if (socket && targetRoomCode) {
      socket.emit('joinRoom', {
        roomCode: targetRoomCode.toUpperCase(),
        name: joinName,
        playerId: localPlayerId,
        password: password
      });
    }
  } else {
    // Normal flow (only name change)
    if (!name) {
      alert("Lütfen geçerli bir takma ad girin.");
      return;
    }
    if (socket) {
      socket.emit('changeName', { name });
    }
  }
}

if (modalJoinBtn) {
  modalJoinBtn.addEventListener('click', submitGuestUsername);
}

if (modalUsernameInput) {
  modalUsernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitGuestUsername();
    }
  });
}

if (modalPasswordInput) {
  modalPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitGuestUsername();
    }
  });
}

// Hide modal on successful name registration
if (socket) {
  socket.on('nameChangeSuccess', () => {
    if (usernameModalOverlay) {
      usernameModalOverlay.classList.remove('active');
    }
    // Update player name in saved session details
    if (modalUsernameInput) {
      const name = modalUsernameInput.value.trim();
      safeSetStorage('playerName', name);
    }
  });
}
// ============ RESOLUTION / ZOOM SCALE CONTROLLER ============
const scaleSelect = document.getElementById('resolution-scale-select');

function applyAppScale(scale) {
  document.body.style.zoom = scale;
}

// Load and apply saved scale choice on page startup
const savedScale = safeGetStorage('appScale') || '1.0';
applyAppScale(savedScale);

if (scaleSelect) {
  scaleSelect.value = savedScale;
  scaleSelect.addEventListener('change', (e) => {
    const scale = e.target.value;
    applyAppScale(scale);
    safeSetStorage('appScale', scale);
  });
}

// ============ CHAT TOGGLE CONTROLLER ============
const toggleChatBtn = document.getElementById('toggle-chat-btn');
const gameChatPanel = document.getElementById('game-chat-panel');
if (toggleChatBtn && gameChatPanel) {
  toggleChatBtn.addEventListener('click', () => {
    const isCollapsed = gameChatPanel.classList.toggle('collapsed');
    if (isCollapsed) {
      toggleChatBtn.innerHTML = '<i class="fa-solid fa-eye"></i> Göster';
      toggleChatBtn.title = "Sohbeti Göster";
    } else {
      toggleChatBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Gizle';
      toggleChatBtn.title = "Sohbeti Gizle";
    }
  });
}

// ============ LOG TOGGLE CONTROLLER ============
const toggleLogBtn = document.getElementById('toggle-log-btn');
const gameLogPanel = document.getElementById('game-log-panel');
if (toggleLogBtn && gameLogPanel) {
  toggleLogBtn.addEventListener('click', () => {
    const isCollapsed = gameLogPanel.classList.toggle('collapsed');
    if (isCollapsed) {
      toggleLogBtn.innerHTML = '<i class="fa-solid fa-eye"></i> Göster';
      toggleLogBtn.title = "Günlüğü Göster";
    } else {
      toggleLogBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Gizle';
      toggleLogBtn.title = "Günlüğü Gizle";
    }
  });
}

// ============ INTERACTIVE FEEDBACK FORM SUBMITTER ============
const feedbackForm = document.getElementById('feedback-submit-form');
const feedbackUserField = document.getElementById('feedback-username');
const feedbackContentField = document.getElementById('feedback-content');

if (feedbackForm) {
  feedbackForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = feedbackUserField ? feedbackUserField.value.trim() : 'Anonim';
    const text = feedbackContentField ? feedbackContentField.value.trim() : '';

    if (!text) return;

    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, text })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert("Geri bildiriminiz başarıyla iletildi! Çok teşekkür ederiz. 😊");
          if (feedbackContentField) feedbackContentField.value = '';
        } else {
          alert("Geri bildirim gönderilemedi, lütfen tekrar deneyin.");
        }
      })
      .catch(err => {
        console.error('Feedback submit error:', err);
        alert("Geri bildirim gönderilirken bağlantı hatası oluştu.");
      });
  });
}

// Background preloading of all character images and card textures dynamically to ensure instant rendering in-game
function preloadCharacterImages() {
  // Preload static card assets immediately
  const cardAssets = [
    'logos/ekipkartlari.png',
    'logos/liderkartlari.png',
    'logos/otopark.png'
  ];
  cardAssets.forEach(src => {
    const img = new Image();
    img.src = src;
  });
  console.log(`[PRELOADER] 3 adet oyun kartı dokusu önbelleğe alındı.`);

  fetch('/api/characters')
    .then(res => res.json())
    .then(chars => {
      if (Array.isArray(chars)) {
        chars.forEach(char => {
          if (char && char.image) {
            const img = new Image();
            img.src = char.image;
          }
        });
        console.log(`[PRELOADER] ${chars.length} adet karakter görseli arka planda önbelleğe alındı.`);
      }
    })
    .catch(err => {
      console.error('[PRELOADER ERROR] Karakterler önbelleğe alınamadı:', err);
    });
}

