#!/bin/bash

APP_NAME="tooldock-othello"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

check_node() {
    if ! command -v node &> /dev/null
    then
        echo "Error: Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    if ! command -v npm &> /dev/null
    then
        echo "Error: npm is not installed. Please install npm first."
        exit 1
    fi
}

check_pm2() {
    if ! command -v pm2 &> /dev/null
    then
        echo "PM2 is not installed. Installing PM2 globally..."
        npm install pm2 -g
    fi
}

write_files() {
    echo "Writing application files..."
    
    # Write package.json
    cat << 'EOF' > package.json
{
  "name": "othello-relay-server",
  "version": "1.0.0",
  "description": "Relay server for ToolDock Othello game",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "ws": "^8.16.0",
    "uuid": "^9.0.1"
  }
}
EOF

    # Write server.js
    cat << 'EOF' > server.js
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = parseInt(process.env.PORT || '3030', 10);
const wss = new WebSocket.Server({ port: PORT });

const rooms = new Map();
const sessionMap = new Map(); 

console.log(`Othello Relay Server started on port ${PORT}`);

function initBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = 2;
    board[3][4] = 1;
    board[4][3] = 1;
    board[4][4] = 2;
    return board;
}

wss.on('connection', (ws) => {
    const socketId = uuidv4();
    ws.id = socketId;
    console.log(`Client connected: ${socketId}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (e) {
            console.error('Invalid message:', e);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${socketId}`);
        handleDisconnect(ws);
    });

    ws.on('error', (err) => {
        console.error(`Socket error: ${err}`);
    });
});

function handleMessage(ws, data) {
    const { type, payload } = data;

    switch (type) {
        case 'CREATE_ROOM': {
            const { nick, userId } = payload;
            const roomId = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit code
            const finalUserId = userId || uuidv4();

            const room = {
                id: roomId,
                players: {},
                board: initBoard(),
                curTurn: 1, // Black starts
                state: 'waiting'
            };

            // Creator is always Black (1)
            room.players[finalUserId] = {
                userId: finalUserId,
                nick,
                color: 1,
                ws
            };

            rooms.set(roomId, room);
            sessionMap.set(finalUserId, { roomId, color: 1, nick });

            ws.userId = finalUserId;
            ws.roomId = roomId;

            send(ws, 'ROOM_CREATED', { roomId, userId: finalUserId, color: 1, board: room.board });
            break;
        }

        case 'JOIN_ROOM': {
            const { roomId, nick, userId } = payload;
            const room = rooms.get(roomId);

            if (!room) {
                send(ws, 'ERROR', { message: 'Room not found' });
                return;
            }

            // Check if user is reconnecting
            if (userId && room.players[userId]) {
                const player = room.players[userId];
                player.ws = ws; // Update socket
                ws.userId = userId;
                ws.roomId = roomId;
                
                send(ws, 'REJOINED', { 
                    roomId, 
                    color: player.color, 
                    board: room.board, 
                    curTurn: room.curTurn, 
                    state: room.state,
                    players: getPublicPlayers(room)
                });
                
                broadcast(room, 'PLAYER_RECONNECTED', { nick: player.nick });
                return;
            }

            if (Object.keys(room.players).length >= 2) {
                send(ws, 'ERROR', { message: 'Room is full' });
                return;
            }

            const finalUserId = userId || uuidv4();
            const color = 2; // Second joiner is White

            room.players[finalUserId] = {
                userId: finalUserId,
                nick,
                color,
                ws
            };
            
            room.state = 'playing';
            sessionMap.set(finalUserId, { roomId, color, nick });

            ws.userId = finalUserId;
            ws.roomId = roomId;

            send(ws, 'JOINED', { 
                roomId, 
                userId: finalUserId, 
                color, 
                board: room.board,
                curTurn: room.curTurn 
            });

            broadcast(room, 'GAME_START', { 
                players: getPublicPlayers(room),
                board: room.board,
                curTurn: room.curTurn
            });
            break;
        }

        case 'MOVE': {
            const { row, col } = payload;
            const room = rooms.get(ws.roomId);
            if (!room) return;

            const player = room.players[ws.userId];
            if (!player || room.curTurn !== player.color || room.state !== 'playing') {
                return;
            }

            if (isValidMove(room.board, row, col, player.color)) {
                const flipped = executeMove(room.board, row, col, player.color);
                
                room.curTurn = player.color === 1 ? 2 : 1;

                if (!hasValidMoves(room.board, room.curTurn)) {
                    room.curTurn = player.color;
                    if (!hasValidMoves(room.board, room.curTurn)) {
                        room.state = 'ended';
                        const score = calculateScore(room.board);
                        broadcast(room, 'GAME_OVER', { board: room.board, score, reason: 'No moves left' });
                        return;
                    } else {
                        broadcast(room, 'SKIP_TURN', { player: room.curTurn === 1 ? 2 : 1 });
                    }
                }

                broadcast(room, 'BOARD_UPDATE', { 
                    board: room.board, 
                    curTurn: room.curTurn,
                    lastMove: { row, col, color: player.color, flippedCount: flipped.length }
                });
            } else {
                send(ws, 'ERROR', { message: 'Invalid move' });
            }
            break;
        }

        case 'RESTART_REQUEST': {
            const room = rooms.get(ws.roomId);
            if (!room) return;
            room.board = initBoard();
            room.curTurn = 1;
            room.state = 'playing';
            broadcast(room, 'GAME_RESTARTED', { 
                board: room.board, 
                curTurn: room.curTurn 
            });
            break;
        }

        case 'CHAT_MESSAGE': {
            const room = rooms.get(ws.roomId);
            if (!room) return;
            
            const player = room.players[ws.userId];
            if (!player) return;

            broadcast(room, 'CHAT', {
                sender: player.nick,
                content: payload.message,
                timestamp: Date.now()
            });
            break;
        }

        case 'LEAVE': {
           handleDisconnect(ws);
           break;
        }
    }
}

function handleDisconnect(ws) {
    if (!ws.roomId) return;
    const room = rooms.get(ws.roomId);
    if (room) {
        broadcast(room, 'PLAYER_DISCONNECTED', { userId: ws.userId });
        const connectCount = Object.values(room.players).filter(p => p.ws.readyState === WebSocket.OPEN).length;
        if (connectCount === 0) {
            // Can add logic here to cleanup empty rooms if needed
        }
    }
}

function send(ws, type, payload) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
    }
}

function broadcast(room, type, payload) {
    Object.values(room.players).forEach(p => {
        send(p.ws, type, payload);
    });
}

function getPublicPlayers(room) {
    return Object.values(room.players).map(p => ({
        nick: p.nick,
        color: p.color
    }));
}

const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

function isValidMove(board, r, c, color) {
    if (r < 0 || r >= 8 || c < 0 || c >= 8) return false;
    if (board[r][c] !== 0) return false;

    const opp = color === 1 ? 2 : 1;

    for (const [dr, dc] of DIRECTIONS) {
        let nr = r + dr;
        let nc = c + dc;
        let foundOpp = false;

        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            if (board[nr][nc] === opp) {
                foundOpp = true;
            } else if (board[nr][nc] === color) {
                if (foundOpp) return true;
                break;
            } else {
                break;
            }
            nr += dr;
            nc += dc;
        }
    }
    return false;
}

function executeMove(board, r, c, color) {
    const opp = color === 1 ? 2 : 1;
    const flipped = [];
    board[r][c] = color;

    for (const [dr, dc] of DIRECTIONS) {
        let nr = r + dr;
        let nc = c + dc;
        let path = [];

        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            if (board[nr][nc] === opp) {
                path.push({r: nr, c: nc});
            } else if (board[nr][nc] === color) {
                if (path.length > 0) {
                    flipped.push(...path);
                    path.forEach(p => board[p.r][p.c] = color);
                }
                break;
            } else {
                break;
            }
            nr += dr;
            nc += dc;
        }
    }
    return flipped;
}

function hasValidMoves(board, color) {
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            if(isValidMove(board, r, c, color)) return true;
        }
    }
    return false;
}

function calculateScore(board) {
    let black = 0;
    let white = 0;
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            if(board[r][c] === 1) black++;
            else if(board[r][c] === 2) white++;
        }
    }
    return { black, white };
}
EOF
}

install() {
    echo "=== Installing $APP_NAME ==="
    check_node
    
    cd "$SCRIPT_DIR" || exit 1
    
    write_files
    
    echo "Installing dependencies..."
    npm install
    
    check_pm2
    
    echo "Installation complete."
}

start() {
    echo "=== Starting $APP_NAME ==="
    check_pm2
    cd "$SCRIPT_DIR" || exit 1
    
    if [ ! -f "server.js" ]; then
        echo "Error: server.js not found. Please run 'install' first."
        exit 1
    fi
    
    # Check if already running
    if pm2 list | grep -q "$APP_NAME"; then
        echo "App is already in PM2 list. Restarting..."
        pm2 restart "$APP_NAME"
    else
        pm2 start server.js --name "$APP_NAME"
    fi
    
    echo "Server started."
    pm2 save
}

stop() {
    echo "=== Stopping $APP_NAME ==="
    check_pm2
    pm2 stop "$APP_NAME"
    echo "Server stopped."
}

uninstall() {
    echo "=== Uninstalling $APP_NAME ==="
    check_pm2
    
    pm2 delete "$APP_NAME"
    pm2 save
    
    echo "Removing server files and node_modules..."
    rm -rf "$SCRIPT_DIR/node_modules"
    rm -f "$SCRIPT_DIR/package.json"
    rm -f "$SCRIPT_DIR/server.js"
    rm -f "$SCRIPT_DIR/package-lock.json"
    
    echo "Uninstallation complete."
}

status() {
    check_pm2
    pm2 show "$APP_NAME"
}

case "$1" in
    install)
        install
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        start
        ;;
    uninstall)
        uninstall
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {install|start|stop|restart|uninstall|status}"
        exit 1
        ;;
esac

exit 0
