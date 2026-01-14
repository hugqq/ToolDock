import React, { useState, useEffect, useCallback, useRef } from "react";
import { ToolLayout } from "../components/layout/ToolLayout";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
  Chip,
  Alert,
  Snackbar,
  useTheme,
} from "@mui/material";
import {
  RefreshCw as Refresh,
  Settings as SettingsIcon,
  Wifi,
  User,
  Disc,
} from "lucide-react";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { InstructionsCard } from "../components/shared/InstructionsCard";

// --- Types ---
type Player = 1 | 2; // 1: Black, 2: White
type Cell = 0 | 1 | 2; // 0: Empty
type Board = Cell[][];
type GameMode = "local" | "online" | null;
type GameState = "waiting" | "playing" | "ended";

interface OnlineState {
  connected: boolean;
  roomId: string | null;
  myColor: Player | null; // null if spectator or not joined
  nick: string;
  opponentNick: string | null;
}

interface ChatMessage {
  sender: string;
  content: string;
  timestamp: number;
}

// --- Logic ---
const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const playMoveSound = () => {
  try {
    const AudioContextClass =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    const now = audioCtx.currentTime;

    // 1. 瞬间敲击声 (High Click) - 棋子接触棋盘的一刹那
    const clickOsc = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    clickOsc.type = "sine";
    clickOsc.frequency.setValueAtTime(1500, now); // 降低频率，减少刺耳感
    clickGain.gain.setValueAtTime(0.08, now); // 降低力度
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
    clickOsc.connect(clickGain);
    clickGain.connect(audioCtx.destination);

    // 2. 木质棋盘共鸣 (Wood Resonance) - 模拟空心木盒的沉闷回响
    const bodyOsc = audioCtx.createOscillator();
    const bodyGain = audioCtx.createGain();
    bodyOsc.type = "triangle";
    bodyOsc.frequency.setValueAtTime(400, now); // 降低基频
    bodyOsc.frequency.exponentialRampToValueAtTime(80, now + 0.1); // 延长一点，更温和
    bodyGain.gain.setValueAtTime(0.3, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(audioCtx.destination);

    // 3. 接触摩擦声 (Physical Texture) - 类似石头摩擦的声音细节
    const bufferSize = audioCtx.sampleRate * 0.03;
    const noiseBuffer = audioCtx.createBuffer(
      1,
      bufferSize,
      audioCtx.sampleRate
    );
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = "lowpass"; // 改用低通滤波，过滤高频
    noiseFilter.frequency.setValueAtTime(800, now);
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.03, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    clickOsc.start(now);
    bodyOsc.start(now);
    noiseSource.start(now);

    clickOsc.stop(now + 0.02);
    bodyOsc.stop(now + 0.1);
  } catch (e) {
    console.warn("Audio playback failed", e);
  }
};

const INIT_BOARD: Board = Array(8)
  .fill(null)
  .map(() => Array(8).fill(0));
INIT_BOARD[3][3] = 2;
INIT_BOARD[3][4] = 1;
INIT_BOARD[4][3] = 1;
INIT_BOARD[4][4] = 2;

function isValidMove(
  board: Board,
  r: number,
  c: number,
  color: Player
): boolean {
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

function hasValidMoves(board: Board, color: Player): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (isValidMove(board, r, c, color)) return true;
    }
  }
  return false;
}

function executeMove(board: Board, r: number, c: number, color: Player): Board {
  const newBoard = board.map((row) => [...row]);
  const opp = color === 1 ? 2 : 1;
  newBoard[r][c] = color;

  for (const [dr, dc] of DIRECTIONS) {
    let nr = r + dr;
    let nc = c + dc;
    let path: { r: number; c: number }[] = [];

    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      if (newBoard[nr][nc] === opp) {
        path.push({ r: nr, c: nc });
      } else if (newBoard[nr][nc] === color) {
        if (path.length > 0) {
          path.forEach((p) => (newBoard[p.r][p.c] = color));
        }
        break;
      } else {
        break;
      }
      nr += dr;
      nc += dc;
    }
  }
  return newBoard;
}

function calculateScore(board: Board) {
  let black = 0;
  let white = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === 1) black++;
      else if (board[r][c] === 2) white++;
    }
  }
  return { black, white };
}

// --- Components ---

const Piece = ({ color }: { color: 1 | 2 }) => {
  return (
    <motion.div
      initial={{ rotateY: color === 2 ? 180 : 0 }}
      animate={{ rotateY: color === 2 ? 180 : 0 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
      }}
      style={{
        width: 32,
        height: 32,
        position: "relative",
        transformStyle: "preserve-3d",
      }}
    >
      {/* Front (Black) */}
      <Box
        sx={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backfaceVisibility: "hidden",
          borderRadius: "50%",
          bgcolor: "black",
          boxShadow: "1px 1px 4px rgba(0,0,0,0.5)",
          background: "radial-gradient(circle at 30% 30%, #444, #000)",
        }}
      />
      {/* Back (White) */}
      <Box
        sx={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backfaceVisibility: "hidden",
          borderRadius: "50%",
          bgcolor: "white",
          transform: "rotateY(180deg)",
          boxShadow: "1px 1px 4px rgba(0,0,0,0.5)",
          background: "radial-gradient(circle at 30% 30%, #fff, #ccc)",
        }}
      />
    </motion.div>
  );
};

interface CellProps {
  r: number;
  c: number;
  val: Cell;
  isLegal: boolean;
  onClick: (r: number, c: number) => void;
}

const CellItem = React.memo(({ r, c, val, isLegal, onClick }: CellProps) => {
  return (
    <Box
      onClick={() => onClick(r, c)}
      sx={{
        width: 44,
        height: 44,
        backgroundColor: "#2e7d32",
        border: "1px solid #145a32", // 更深色的绿色边框
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: isLegal ? "pointer" : "default",
        position: "relative",
        perspective: 1000,
        boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.3)", // 内阴影增加凹陷感
        transition: "all 0.2s",
        "&:hover": {
          bgcolor: isLegal ? "#388e3c" : "#2e7d32", // Legal move highlight
        },
      }}
    >
      {/* Helper Dot for valid moves */}
      {isLegal && (
        <Box
          sx={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            bgcolor: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(0,0,0,0.1)",
            zIndex: 1,
            boxShadow: "inset 1px 1px 2px rgba(0,0,0,0.3)",
          }}
        />
      )}
      {val !== 0 && <Piece color={val as 1 | 2} />}
    </Box>
  );
});

// --- Main Component ---
const Othello: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const settings = useSettingsStore((state) => state.othello);
  const setOthelloConfig = useSettingsStore((state) => state.setOthelloConfig);

  // Game UI State
  const [board, setBoard] = useState<Board>(
    JSON.parse(JSON.stringify(INIT_BOARD))
  );
  const [turn, setTurn] = useState<Player>(1);
  const [mode, setMode] = useState<GameMode>(null); // 'local' or 'online'
  const [gameState, setGameState] = useState<GameState>("waiting"); // 'waiting', 'playing', 'ended'

  // Online State
  const [onlineState, setOnlineState] = useState<OnlineState>({
    connected: false,
    roomId: null,
    myColor: null,
    nick: settings?.nickname || "Player",
    opponentNick: null,
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Controls
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState(
    settings?.serverUrl || "ws://localhost:3030"
  );
  const [joinRoomId, setJoinRoomId] = useState("");
  const [snackMsg, setSnackMsg] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // AI Settings
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium"
  );
  const [playerColor, setPlayerColor] = useState<Player>(1); // 1: Black, 2: White

  const ws = useRef<WebSocket | null>(null);

  // --- Helpers ---
  const resetGame = () => {
    const newBoard = JSON.parse(JSON.stringify(INIT_BOARD));
    setBoard(newBoard);
    setTurn(1);
    setGameState("playing");

    // If player chose White, AI (Black) moves first
    if (playerColor === 2) {
      setTimeout(() => makeAIMove(newBoard), 600);
    }
  };

  // --- Local Logic (AI) ---
  // Position weights for AI evaluation (corners are most valuable)
  const POSITION_WEIGHTS = [
    [100, -20, 10, 5, 5, 10, -20, 100],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [10, -2, -1, -1, -1, -1, -2, 10],
    [5, -2, -1, -1, -1, -1, -2, 5],
    [5, -2, -1, -1, -1, -1, -2, 5],
    [10, -2, -1, -1, -1, -1, -2, 10],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [100, -20, 10, 5, 5, 10, -20, 100],
  ];

  const getAIMove = (
    board: Board,
    aiColor: Player,
    difficulty: "easy" | "medium" | "hard"
  ): { r: number; c: number } | null => {
    const validMoves: { r: number; c: number; score: number }[] = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (isValidMove(board, r, c, aiColor)) {
          const flippedCount = countFlipped(board, r, c, aiColor);
          let score = 0;

          switch (difficulty) {
            case "easy":
              // Random with slight preference for corners
              score =
                Math.random() * 10 + (POSITION_WEIGHTS[r][c] > 50 ? 20 : 0);
              break;
            case "medium":
              // Position weight + flipped count
              score = POSITION_WEIGHTS[r][c] * 0.7 + flippedCount * 3;
              break;
            case "hard":
              // Advanced: position + flipped + mobility
              const testBoard = board.map((row) => [...row]);
              executeMove(testBoard, r, c, aiColor);
              const opponentColor = aiColor === 1 ? 2 : 1;
              const opponentMoves = countValidMoves(testBoard, opponentColor);
              score =
                POSITION_WEIGHTS[r][c] + flippedCount * 4 - opponentMoves * 2;
              break;
          }

          validMoves.push({ r, c, score });
        }
      }
    }

    if (validMoves.length === 0) return null;

    // Sort by score and pick the best
    validMoves.sort((a, b) => b.score - a.score);
    return { r: validMoves[0].r, c: validMoves[0].c };
  };

  const countValidMoves = (board: Board, color: Player): number => {
    let count = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (isValidMove(board, r, c, color)) count++;
      }
    }
    return count;
  };

  const countFlipped = (
    board: Board,
    r: number,
    c: number,
    color: Player
  ): number => {
    const opp = color === 1 ? 2 : 1;
    let count = 0;

    for (const [dr, dc] of DIRECTIONS) {
      let nr = r + dr;
      let nc = c + dc;
      let tempCount = 0;

      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        if (board[nr][nc] === opp) {
          tempCount++;
        } else if (board[nr][nc] === color) {
          count += tempCount;
          break;
        } else {
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
    return count;
  };

  const makeAIMove = (currentBoard: Board) => {
    const aiColor = playerColor === 1 ? 2 : 1;
    const aiMove = getAIMove(currentBoard, aiColor, aiDifficulty);

    if (!aiMove) {
      // AI has no valid moves
      if (hasValidMoves(currentBoard, playerColor)) {
        setTurn(playerColor);
        setSnackMsg(t("tools.othello.ai_no_moves"));
      } else {
        setGameState("ended");
      }
      return;
    }

    // Apply AI move immediately
    const nextBoard = executeMove(currentBoard, aiMove.r, aiMove.c, aiColor);
    setBoard(nextBoard);
    playMoveSound();

    // Check if player can move
    if (hasValidMoves(nextBoard, playerColor)) {
      setTurn(playerColor);
    } else {
      if (hasValidMoves(nextBoard, aiColor)) {
        setSnackMsg(t("tools.othello.no_moves_pass"));
        setTurn(aiColor);
        // AI continues on next tick
        setTimeout(() => makeAIMove(nextBoard), 800);
      } else {
        setGameState("ended");
      }
    }
  };

  const handleLocalClick = (r: number, c: number) => {
    if (gameState !== "playing") return;
    if (turn !== playerColor) return; // Only player's turn
    if (!isValidMove(board, r, c, playerColor)) {
      return;
    }

    // Apply Player Move
    const nextBoard = executeMove(board, r, c, playerColor);
    setBoard(nextBoard);
    playMoveSound();

    const aiColor = playerColor === 1 ? 2 : 1;

    // Check if AI can move
    if (hasValidMoves(nextBoard, aiColor)) {
      setTurn(aiColor);
      setTimeout(() => makeAIMove(nextBoard), 600);
    } else {
      // AI has no moves, check if player can continue
      if (hasValidMoves(nextBoard, playerColor)) {
        setSnackMsg(t("tools.othello.opponent_passed"));
        setTurn(playerColor);
      } else {
        setGameState("ended");
      }
    }
  };

  // --- Online Logic ---
  const connectServer = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.close();
    }
    try {
      const socket = new WebSocket(
        settings?.serverUrl || "ws://localhost:3030"
      );

      socket.onopen = () => {
        setOnlineState((prev) => ({ ...prev, connected: true }));
        setSnackMsg(t("tools.othello.connected"));
        // Try restore? Not implemented yet
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleServerMessage(data.type, data.payload);
        } catch (e) {
          console.error("Invalid server message:", event.data);
        }
      };

      socket.onclose = () => {
        setOnlineState((prev) => ({
          ...prev,
          connected: false,
          roomId: null,
          myColor: null,
        }));
        setSnackMsg(t("tools.othello.disconnected"));
      };

      socket.onerror = () => {
        setSnackMsg(t("tools.othello.connection_error"));
      };

      ws.current = socket;
    } catch (e) {
      setSnackMsg(t("tools.othello.invalid_url"));
    }
  }, [settings?.serverUrl]);

  const handleServerMessage = (type: string, payload: any) => {
    switch (type) {
      case "ROOM_CREATED":
        setIsCreating(false);
        setOnlineState((prev) => ({
          ...prev,
          roomId: payload.roomId,
          myColor: payload.color,
        }));
        setBoard(payload.board);
        setTurn(payload.curTurn || 1);
        setGameState("waiting"); // Creator waits for opponent
        setSnackMsg(`Room created: ${payload.roomId}`);
        break;

      case "JOINED":
        setOnlineState((prev) => ({
          ...prev,
          roomId: payload.roomId,
          myColor: payload.color,
        }));
        setBoard(payload.board);
        setTurn(payload.curTurn || 1);
        // Don't set to playing yet, wait for GAME_START
        break;

      case "REJOINED":
        setOnlineState((prev) => ({
          ...prev,
          roomId: payload.roomId,
          myColor: payload.color,
        }));
        setBoard(payload.board);
        setTurn(payload.curTurn);
        setGameState(
          payload.state === "playing"
            ? "playing"
            : payload.state === "ended"
            ? "ended"
            : "waiting"
        );
        if (payload.players) {
          // update players info if needed
        }
        break;

      case "GAME_START":
        setGameState("playing");
        if (payload.board) {
          setBoard(payload.board);
        }
        if (payload.curTurn) {
          setTurn(payload.curTurn);
        }
        // payload.players has nicks
        break;

      case "BOARD_UPDATE":
        setBoard(payload.board);
        setTurn(payload.curTurn);
        playMoveSound();
        break;

      case "SKIP_TURN":
        setTurn(payload.player);
        setSnackMsg(t("tools.othello.opponent_passed"));
        break;

      case "GAME_OVER":
        setBoard(payload.board);
        setGameState("ended");
        if (payload.score) {
          const { black, white } = payload.score;
          const winner =
            black > white ? "Black" : white > black ? "White" : "Draw";
          const winnerText =
            winner === "Draw"
              ? t("tools.othello.draw")
              : `${winner} ${t("tools.othello.wins")}`;
          setSnackMsg(
            `${t(
              "tools.othello.game_over"
            )} - ${winnerText} (${black} vs ${white})`
          );
        } else {
          setSnackMsg(
            `${t("tools.othello.game_over")} - ${
              payload.reason || "Game ended"
            }`
          );
        }
        break;

      case "GAME_RESTARTED":
        setBoard(payload.board);
        setTurn(payload.curTurn);
        setGameState("playing");
        setSnackMsg(t("tools.othello.restarted"));
        break;

      case "PLAYER_DISCONNECTED":
        setSnackMsg(t("tools.othello.opponent_disconnected"));
        break;

      case "CHAT":
        setChatMessages((prev) => [
          ...prev,
          {
            sender: payload.sender,
            content: payload.content,
            timestamp: payload.timestamp,
          },
        ]);
        break;

      case "ERROR":
        setIsCreating(false);
        setSnackMsg(payload.message);
        break;
    }
  };

  const handleOnlineClick = (r: number, c: number) => {
    if (gameState !== "playing") return;
    if (onlineState.myColor !== turn) return; // Not my turn

    // Optimistic checking
    if (!isValidMove(board, r, c, onlineState.myColor)) return;

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "MOVE",
          payload: { row: r, col: c },
        })
      );
    }
  };

  const createRoom = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      console.log("Sending CREATE_ROOM request...");
      setIsCreating(true);
      ws.current.send(
        JSON.stringify({
          type: "CREATE_ROOM",
          payload: { nick: onlineState.nick },
        })
      );

      // Safety timeout in case server doesn't respond
      setTimeout(() => {
        setIsCreating((prev) => {
          if (prev) {
            setSnackMsg("Server timeout: No response for room creation");
            return false;
          }
          return prev;
        });
      }, 5000);
    } else {
      console.warn("WebSocket not open, attempting to reconnect...");
      setSnackMsg(t("tools.othello.connection_lost"));
      connectServer();
    }
  };

  const joinRoom = () => {
    if (!joinRoomId) return;
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "JOIN_ROOM",
          payload: { roomId: joinRoomId, nick: onlineState.nick },
        })
      );
    } else {
      connectServer();
    }
  };

  const requestRestart = () => {
    if (mode === "local") {
      resetGame();
    } else {
      ws.current?.send(
        JSON.stringify({ type: "RESTART_REQUEST", payload: {} })
      );
    }
  };

  const sendChatMessage = (message: string) => {
    if (!message.trim() || ws.current?.readyState !== WebSocket.OPEN) return;
    ws.current.send(
      JSON.stringify({
        type: "CHAT_MESSAGE",
        payload: { message },
      })
    );
  };

  // --- Effects ---
  useEffect(() => {
    return () => {
      ws.current?.close();
    };
  }, []);

  // --- Render Helpers ---
  const score = calculateScore(board);

  const handleCellClick = (r: number, c: number) => {
    mode === "local" ? handleLocalClick(r, c) : handleOnlineClick(r, c);
  };

  const ChatPanel = () => {
    const [msg, setMsg] = useState("");
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, [chatMessages]);

    const handleSend = () => {
      if (!msg.trim()) return;
      sendChatMessage(msg);
      setMsg("");
    };

    return (
      <Card
        sx={{
          mt: 2,
          bgcolor: isDark
            ? "rgba(30, 30, 30, 0.6)"
            : "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(10px)",
          borderRadius: 2,
          boxShadow: isDark
            ? "0 8px 32px 0 rgba(0, 0, 0, 0.5)"
            : "0 8px 32px 0 rgba(31, 38, 135, 0.15)",
          border: isDark
            ? "1px solid rgba(255, 255, 255, 0.08)"
            : "1px solid rgba(255, 255, 255, 0.18)",
          transition: "all 0.3s ease",
          display: "flex",
          flexDirection: "column",
          flexGrow: 1, // Allow filling remaining height
          height: 300,
        }}
      >
        <CardContent
          sx={{
            p: 2,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            "&:last-child": { pb: 2 },
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {t("tools.othello.chat") || "Chat"}
          </Typography>
          <Box
            ref={listRef}
            sx={{
              flexGrow: 1,
              overflowY: "auto",
              mb: 1,
              pr: 1,
              "&::-webkit-scrollbar": { width: 4 },
              "&::-webkit-scrollbar-thumb": {
                bgcolor: "rgba(0,0,0,0.2)",
                borderRadius: 2,
              },
            }}
          >
            {chatMessages.map((m, i) => (
              <Box key={i} mb={1}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight="bold"
                >
                  {m.sender}:
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {m.content}
                </Typography>
              </Box>
            ))}
            {chatMessages.length === 0 && (
              <Typography
                variant="caption"
                color="text.disabled"
                fontStyle="italic"
              >
                {t("tools.othello.no_messages")}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              placeholder={t("tools.othello.type_message")}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleSend}
              sx={{ minWidth: 40, px: 0 }}
            >
              ➤
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  const LobbyView = () => (
    <Stack
      spacing={{ xs: 2, md: 4 }}
      alignItems="center"
      width="100%"
      mt={{ xs: 2, md: 4 }}
    >
      <Box width="100%" maxWidth={800}>
        <InstructionsCard
          title={t("tools.othello.rules_title")}
          icon={Disc}
          steps={[
            {
              title: t("tools.othello.rules_title"),
              description: t("tools.othello.rules_desc"),
            },
            {
              title: t("tools.othello.black"),
              description: t("tools.othello.black_first"),
            },
          ]}
          columns={2}
        />
      </Box>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 2, md: 4 }}
        width="100%"
        justifyContent="center"
      >
        {/* Local Mode Card */}
        <Card
          sx={{
            width: { xs: "100%", md: 300 },
            cursor: "pointer",
            transition: "transform 0.2s",
            "&:hover": { transform: "translateY(-4px)", boxShadow: 6 },
          }}
          onClick={() => {
            setMode("local");
            resetGame();
          }}
        >
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <User size={48} style={{ marginBottom: 16, color: "#1976d2" }} />
            <Typography variant="h5" gutterBottom>
              {t("tools.othello.mode_local")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("tools.othello.mode_local_desc")}
            </Typography>

            {/* AI Settings */}
            <Stack spacing={2} mt={3} onClick={(e) => e.stopPropagation()}>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  mb={1}
                >
                  {t("tools.othello.difficulty")}
                </Typography>
                <Stack direction="row" spacing={1} justifyContent="center">
                  {["easy", "medium", "hard"].map((level) => (
                    <Chip
                      key={level}
                      label={t(`tools.othello.${level}`)}
                      size="small"
                      color={aiDifficulty === level ? "primary" : "default"}
                      onClick={() => setAiDifficulty(level as any)}
                      sx={{ cursor: "pointer" }}
                    />
                  ))}
                </Stack>
              </Box>

              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  mb={1}
                >
                  {t("tools.othello.your_color")}
                </Typography>
                <Stack direction="row" spacing={1} justifyContent="center">
                  <Chip
                    icon={<Disc fill="black" />}
                    label={t("tools.othello.black")}
                    size="small"
                    color={playerColor === 1 ? "primary" : "default"}
                    onClick={() => setPlayerColor(1)}
                    sx={{ cursor: "pointer" }}
                  />
                  <Chip
                    icon={<Disc fill="white" color="black" />}
                    label={t("tools.othello.white")}
                    size="small"
                    color={playerColor === 2 ? "primary" : "default"}
                    onClick={() => setPlayerColor(2)}
                    sx={{
                      cursor: "pointer",
                      color: playerColor === 2 ? "white" : "inherit",
                    }}
                  />
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Online Mode Card */}
        <Card
          sx={{
            width: { xs: "100%", md: 300 },
            cursor: "pointer",
            transition: "transform 0.2s",
            "&:hover": { transform: "translateY(-4px)", boxShadow: 6 },
          }}
          onClick={() => {
            setMode("online");
            setOnlineState((prev) => ({ ...prev, connected: false }));
            connectServer();
          }}
        >
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <Wifi size={48} style={{ marginBottom: 16, color: "#2e7d32" }} />
            <Typography variant="h5" gutterBottom>
              {t("tools.othello.mode_online")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("tools.othello.mode_online_desc")}
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Stack>
  );

  const GameView = () => (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={{ xs: 2, md: 4 }}
      justifyContent="center"
      alignItems={{ xs: "center", md: "flex-start" }}
      sx={{ py: { xs: 1, md: 2 } }}
    >
      {/* Left Column: Board + Chat */}
      <Stack
        spacing={2}
        alignItems="center"
        sx={{ width: "100%", maxWidth: { xs: "100%", md: "auto" } }}
      >
        {/* Center: Game Board */}
        <Box
          sx={{
            transform: { xs: "scale(0.68)", sm: "scale(0.85)", md: "scale(1)" },
            transformOrigin: "top center",
            height: { xs: "360px", sm: "440px", md: "auto" },
            width: "100%",
            display: "flex",
            justifyContent: "center",
            // Prevent layout overflow from the unscaled size
            overflow: { xs: "hidden", md: "visible" },
          }}
        >
          {/* Wood Texture Frame */}
          <Box
            sx={{
              p: 3,
              borderRadius: 2,
              boxShadow: isDark
                ? "0 24px 32px rgba(0, 0, 0, 0.5), inset 0 2px 3px rgba(255, 255, 255, 0.05), inset 0 0 40px rgba(0,0,0,0.6)"
                : "0 24px 32px rgba(0, 0, 0, 0.3), inset 0 2px 3px rgba(255, 255, 255, 0.3), inset 0 0 40px rgba(93, 64, 55, 0.1)",
              bgcolor: isDark ? "#2D2623" : "#E6CCAB",
              border: isDark ? "1px solid #1F1A18" : "1px solid #D7B68E",
              display: "flex",
              flexDirection: "column",
              alignItems: "center", // Make contents centered
              transition: "all 0.3s ease",
            }}
          >
            {/* Top Coordinates (A-H) */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "center", // Align to center
                mb: 1,
                width: "100%",
                pl: "32px", // Compensation for Left Numbers
                pr: "32px", // Compensation for Right Spacer (Symmetry)
              }}
            >
              {/* Inner wrapper to match board width alignment */}
              <Box sx={{ pl: "4px", display: "flex" }}>
                {/* pl="4px" aligns labels with cells inside the 4px border */}
                {["A", "B", "C", "D", "E", "F", "G", "H"].map((label) => (
                  <Box
                    key={label}
                    sx={{
                      width: 44,
                      textAlign: "center",
                      color: isDark ? "#efebe9" : "#5D4037",
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      textShadow: isDark
                        ? "1px 1px 2px rgba(0,0,0,0.6)"
                        : "0 1px 0 rgba(255,255,255,0.4)",
                    }}
                  >
                    {label}
                  </Box>
                ))}
              </Box>
            </Box>

            <Box sx={{ display: "flex", alignItems: "flex-start" }}>
              {/* Left Coordinates (1-8) */}
              <Box
                sx={{
                  width: 32,
                  pt: "4px", // Align with Board content (inside 4px border)
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                  <Box
                    key={num}
                    sx={{
                      height: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isDark ? "#efebe9" : "#5D4037",
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      textShadow: isDark
                        ? "1px 1px 2px rgba(0,0,0,0.6)"
                        : "0 1px 0 rgba(255,255,255,0.4)",
                    }}
                  >
                    {num}
                  </Box>
                ))}
              </Box>

              {/* Inner Board */}
              <Paper
                elevation={20}
                sx={{
                  bgcolor: isDark ? "#1A1614" : "#4E342E",
                  border: isDark ? "4px solid #1A1614" : "4px solid #4E342E",
                  borderRadius: "2px",
                  display: "inline-flex",
                  flexDirection: "column",
                }}
              >
                {board.map((row, r) => (
                  <Box key={r} display="flex">
                    {row.map((val, c) => {
                      const isLegal =
                        mode === "local"
                          ? gameState === "playing" && turn === playerColor
                            ? isValidMove(board, r, c, turn)
                            : false
                          : gameState === "playing" &&
                            onlineState.myColor === turn
                          ? isValidMove(board, r, c, turn)
                          : false;
                      return (
                        <CellItem
                          key={`${r}-${c}`}
                          r={r}
                          c={c}
                          val={val}
                          isLegal={isLegal}
                          onClick={handleCellClick}
                        />
                      );
                    })}
                  </Box>
                ))}
              </Paper>

              {/* Right Spacer for Symmetry */}
              <Box sx={{ width: 32 }} />
            </Box>

            {/* Bottom Spacer for Symmetry with Top Labels */}
            <Box sx={{ height: 32, width: "100%" }} />
          </Box>
        </Box>

        {/* Chat Panel - moved here, below board */}
        {mode === "online" && onlineState.roomId && (
          <Box sx={{ width: "100%", maxWidth: 660 }}>
            <ChatPanel />
          </Box>
        )}
      </Stack>

      {/* Right: Info Panel */}
      <Box sx={{ width: { xs: "100%", md: 350 }, maxWidth: 400 }}>
        <Stack spacing={2}>
          {/* Score Board */}
          <Card
            sx={{
              bgcolor: isDark
                ? "rgba(30, 30, 30, 0.6)"
                : "rgba(255, 255, 255, 0.9)",
              backdropFilter: "blur(10px)",
              borderRadius: 2,
              boxShadow: isDark
                ? "0 8px 32px 0 rgba(0, 0, 0, 0.5)"
                : "0 8px 32px 0 rgba(31, 38, 135, 0.15)",
              border: isDark
                ? "1px solid rgba(255, 255, 255, 0.08)"
                : "1px solid rgba(255, 255, 255, 0.18)",
              transition: "all 0.3s ease",
            }}
          >
            <CardContent>
              <Typography
                variant="overline"
                color="text.secondary"
                fontWeight="bold"
                gutterBottom
              >
                {t("tools.othello.score")}
              </Typography>
              <Stack direction="row" justifyContent="space-between" mb={3}>
                <Box textAlign="center">
                  <Chip
                    icon={<Disc fill="black" size={16} />}
                    label={t("tools.othello.black")}
                    variant={turn === 1 ? "filled" : "outlined"}
                    color={turn === 1 ? "primary" : "default"}
                    sx={{
                      minWidth: 100,
                      justifyContent: "flex-start",
                      pl: 1,
                    }}
                  />
                  <Typography
                    variant="h3"
                    sx={{ typography: { xs: "h4", md: "h3" } }}
                    mt={1}
                    fontWeight="bold"
                    color={turn === 1 ? "primary.main" : "text.secondary"}
                  >
                    {score.black}
                  </Typography>
                </Box>
                <Box textAlign="center">
                  <Chip
                    icon={<Disc fill="white" color="black" size={16} />}
                    label={t("tools.othello.white")}
                    variant={turn === 2 ? "filled" : "outlined"}
                    color={turn === 2 ? "primary" : "default"}
                    sx={{
                      color: turn === 2 ? "black" : "text.primary",
                      bgcolor: turn === 2 ? "white" : "transparent",
                      borderColor: turn === 2 ? "black" : "default",
                      "& .MuiChip-label": { fontWeight: "bold" },
                      "& .MuiChip-icon": { color: "black" },
                      minWidth: 100,
                      justifyContent: "flex-start",
                      pl: 1,
                    }}
                  />
                  <Typography
                    variant="h3"
                    sx={{ typography: { xs: "h4", md: "h3" } }}
                    mt={1}
                    fontWeight="bold"
                    color={turn === 2 ? "text.primary" : "text.secondary"}
                  >
                    {score.white}
                  </Typography>
                </Box>
              </Stack>
              <Alert
                severity="info"
                icon={false}
                sx={{
                  justifyContent: "center",
                  textAlign: "center",
                  fontWeight: "bold",
                  py: 0.5,
                  borderRadius: 2,
                }}
              >
                {gameState === "ended"
                  ? score.black > score.white
                    ? t("tools.othello.black_wins")
                    : score.white > score.black
                    ? t("tools.othello.white_wins")
                    : t("tools.othello.draw")
                  : turn === 1
                  ? t("tools.othello.black_turn")
                  : t("tools.othello.white_turn")}
              </Alert>
            </CardContent>
          </Card>

          {/* Online Lobby Info */}
          {mode === "online" && (
            <Card
              sx={{
                bgcolor: isDark
                  ? "rgba(30, 30, 30, 0.6)"
                  : "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                borderRadius: 2,
                boxShadow: isDark
                  ? "0 8px 32px 0 rgba(0, 0, 0, 0.5)"
                  : "0 8px 32px 0 rgba(31, 38, 135, 0.15)",
                border: isDark
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid rgba(255, 255, 255, 0.18)",
                transition: "all 0.3s ease",
              }}
            >
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  {t("tools.othello.online_status")}
                </Typography>
                <Stack spacing={1}>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      {t("tools.othello.room_id")}:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {onlineState.roomId || "-"}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      {t("tools.othello.you_are")}:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {onlineState.myColor === 1
                        ? t("tools.othello.black")
                        : onlineState.myColor === 2
                        ? t("tools.othello.white")
                        : "-"}
                    </Typography>
                  </Box>
                  {onlineState.opponentNick && (
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        {t("tools.othello.opponent")}:
                      </Typography>
                      <Typography variant="body2">
                        {onlineState.opponentNick}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Button
            variant="contained"
            color="primary"
            onClick={requestRestart}
            startIcon={<Refresh />}
            disabled={gameState !== "ended" && mode === "online"} // Only allow restart when ended in online for now
          >
            {t("tools.othello.restart")}
          </Button>

          <Button
            variant="outlined"
            color="inherit"
            onClick={() => {
              ws.current?.close();
              setMode(null);
              setOnlineState({
                connected: false,
                roomId: null,
                myColor: null,
                nick: settings?.nickname || "Player",
                opponentNick: null,
              });
            }}
          >
            {t("tools.othello.exit")}
          </Button>

          {/* Online Lobby (When in 'online' mode but waiting) */}
          {mode === "online" && !onlineState.roomId && (
            <Card
              sx={{
                mt: 2,
                bgcolor: isDark
                  ? "rgba(30, 30, 30, 0.6)"
                  : "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                borderRadius: 2,
                boxShadow: isDark
                  ? "0 8px 32px 0 rgba(0, 0, 0, 0.5)"
                  : "0 8px 32px 0 rgba(31, 38, 135, 0.15)",
                border: isDark
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid rgba(255, 255, 255, 0.18)",
                transition: "all 0.3s ease",
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t("tools.othello.lobby")}
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label={t("tools.othello.nickname")}
                    size="small"
                    value={onlineState.nick}
                    onChange={(e) => {
                      setOnlineState((p) => ({ ...p, nick: e.target.value }));
                      setOthelloConfig({ nickname: e.target.value });
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={createRoom}
                    disabled={!onlineState.connected || isCreating}
                    fullWidth
                  >
                    {isCreating
                      ? "Creating..."
                      : t("tools.othello.create_room")}
                  </Button>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      label={t("tools.othello.room_id")}
                      size="small"
                      fullWidth
                      value={joinRoomId}
                      onChange={(e) => setJoinRoomId(e.target.value)}
                    />
                    <Button
                      variant="outlined"
                      onClick={joinRoom}
                      disabled={!onlineState.connected}
                    >
                      {t("tools.othello.join")}
                    </Button>
                  </Stack>
                  {!onlineState.connected && (
                    <Button
                      size="small"
                      onClick={connectServer}
                      startIcon={<Refresh />}
                      color="error"
                    >
                      {t("tools.othello.reconnect")}
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Chat Panel - Only show when in room */}
          {/* {mode === "online" && onlineState.roomId && <ChatPanel />} */}
        </Stack>
      </Box>
    </Stack>
  );

  return (
    <ToolLayout title={t("tools.othello.title")}>
      <Container sx={{ py: { xs: 1, md: 2 } }}>
        {mode === null && (
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button
              startIcon={<SettingsIcon />}
              onClick={() => setSettingsOpen(true)}
              variant="outlined"
              size="small"
            >
              {t("tools.othello.server_config")}
            </Button>
          </Box>
        )}

        {mode === null ? <LobbyView /> : <GameView />}
      </Container>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <DialogTitle>{t("tools.othello.server_config")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t("tools.othello.server_url")}
            fullWidth
            variant="outlined"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            helperText="Example: ws://localhost:3030 or ws://192.168.1.5:3030"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              setOthelloConfig({ serverUrl: inputUrl });
              setSettingsOpen(false);
              if (mode === "online") {
                connectServer();
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackMsg}
        autoHideDuration={4000}
        onClose={() => setSnackMsg(null)}
        message={snackMsg}
      />
    </ToolLayout>
  );
};

export default Othello;
