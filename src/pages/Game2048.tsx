import { useState, useEffect, useCallback } from "react";
import { ToolLayout } from "../components/layout/ToolLayout";
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
  useTheme,
  FormControlLabel,
  Switch,
} from "@mui/material";
import {
  RotateCcw as ResetIcon,
  Cpu as AiIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { InstructionsDialog } from "../components/shared/InstructionsDialog";

// --- Types ---
type Grid = number[][];
type GameStatus = "playing" | "won" | "over";

const GRID_SIZE = 4;

const getEmptyCells = (grid: Grid) => {
  const empty: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) empty.push([r, c]);
    }
  }
  return empty;
};

const spawnTile = (grid: Grid): Grid => {
  const empty = getEmptyCells(grid);
  if (empty.length === 0) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const newGrid = grid.map((row) => [...row]);
  newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return newGrid;
};

const initGame = (): Grid => {
  let grid = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(0));
  grid = spawnTile(grid);
  grid = spawnTile(grid);
  return grid;
};

const moveLeft = (
  grid: Grid
): { newGrid: Grid; score: number; changed: boolean } => {
  let score = 0;
  let changed = false;
  const newGrid = grid.map((row) => {
    // 1. Filter out zeros
    let filtered = row.filter((val) => val !== 0);
    // 2. Merge
    const mergedRow: number[] = [];
    for (let i = 0; i < filtered.length; i++) {
      if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
        const newVal = filtered[i] * 2;
        mergedRow.push(newVal);
        score += newVal;
        i++;
        changed = true;
      } else {
        mergedRow.push(filtered[i]);
      }
    }
    // 3. Fill zeros
    while (mergedRow.length < GRID_SIZE) {
      mergedRow.push(0);
    }
    if (JSON.stringify(mergedRow) !== JSON.stringify(row)) {
      changed = true;
    }
    return mergedRow;
  });
  return { newGrid, score, changed };
};

const rotateGrid = (grid: Grid): Grid => {
  const newGrid = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(0));
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      newGrid[c][GRID_SIZE - 1 - r] = grid[r][c];
    }
  }
  return newGrid;
};

const moveGrid = (
  grid: Grid,
  direction: "left" | "right" | "up" | "down"
): { newGrid: Grid; score: number; changed: boolean } => {
  let currentGrid = grid;
  let rotations = 0;

  if (direction === "up") rotations = 3;
  else if (direction === "right") rotations = 2;
  else if (direction === "down") rotations = 1;

  for (let i = 0; i < rotations; i++) {
    currentGrid = rotateGrid(currentGrid);
  }

  const result = moveLeft(currentGrid);
  let finalGrid = result.newGrid;

  for (let i = 0; i < (4 - rotations) % 4; i++) {
    finalGrid = rotateGrid(finalGrid);
  }

  return { newGrid: finalGrid, score: result.score, changed: result.changed };
};

const canMove = (grid: Grid): boolean => {
  if (getEmptyCells(grid).length > 0) return true;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const val = grid[r][c];
      if (c < GRID_SIZE - 1 && val === grid[r][c + 1]) return true;
      if (r < GRID_SIZE - 1 && val === grid[r + 1][c]) return true;
    }
  }
  return false;
};

// --- AI Logic ---
const evaluateGrid = (grid: Grid): number => {
  let score = 0;

  // 1. Empty cells (critical for space)
  const emptyCells = getEmptyCells(grid).length;
  score += emptyCells * emptyCells * 1024; // Heavily weight empty space

  // 2. Maximum tile value
  let maxTile = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      maxTile = Math.max(maxTile, grid[r][c]);
    }
  }
  score += maxTile * 32;

  // 3. Monotonicity - prefer keeping large tiles at corners
  // Strong snake pattern: top-left corner strategy
  const weights = [
    [65536, 32768, 16384, 8192],
    [512, 1024, 2048, 4096],
    [256, 128, 64, 32],
    [1, 2, 4, 8],
  ];

  let positionScore = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] !== 0) {
        positionScore += grid[r][c] * weights[r][c];
      }
    }
  }
  score += positionScore;

  // 4. Smoothness - penalize large differences between adjacent tiles
  let smoothness = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] !== 0) {
        const val = grid[r][c];
        // Check right
        if (c < GRID_SIZE - 1 && grid[r][c + 1] !== 0) {
          const diff = Math.abs(val - grid[r][c + 1]);
          smoothness -= diff;
        }
        // Check down
        if (r < GRID_SIZE - 1 && grid[r + 1][c] !== 0) {
          const diff = Math.abs(val - grid[r + 1][c]);
          smoothness -= diff;
        }
      }
    }
  }
  score += smoothness * 2;

  // 5. Merge potential - reward tiles that can be merged
  let mergeBonus = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE - 1; c++) {
      if (grid[r][c] !== 0 && grid[r][c] === grid[r][c + 1]) {
        mergeBonus += grid[r][c] * 16;
      }
    }
  }
  for (let r = 0; r < GRID_SIZE - 1; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] !== 0 && grid[r][c] === grid[r + 1][c]) {
        mergeBonus += grid[r][c] * 16;
      }
    }
  }
  score += mergeBonus;

  return score;
};

// Expectimax search with depth
const expectimaxSearch = (
  grid: Grid,
  depth: number,
  isPlayer: boolean
): number => {
  if (depth === 0 || !canMove(grid)) {
    return evaluateGrid(grid);
  }

  if (isPlayer) {
    // Maximize over possible moves
    let maxScore = -Infinity;
    const directions: ("left" | "right" | "up" | "down")[] = [
      "left",
      "right",
      "up",
      "down",
    ];

    for (const dir of directions) {
      const { newGrid, changed } = moveGrid(grid, dir);
      if (changed) {
        const score = expectimaxSearch(newGrid, depth - 1, false);
        maxScore = Math.max(maxScore, score);
      }
    }
    return maxScore === -Infinity ? evaluateGrid(grid) : maxScore;
  } else {
    // Expect over random tile spawns
    const emptyCells = getEmptyCells(grid);
    if (emptyCells.length === 0) return evaluateGrid(grid);

    let totalScore = 0;
    const sampleSize = Math.min(emptyCells.length, 4); // Sample at most 4 positions

    for (let i = 0; i < sampleSize; i++) {
      const [r, c] = emptyCells[i];
      // Try spawning a 2 (90% probability)
      const newGrid2 = grid.map((row) => [...row]);
      newGrid2[r][c] = 2;
      totalScore += 0.9 * expectimaxSearch(newGrid2, depth - 1, true);

      // Try spawning a 4 (10% probability)
      const newGrid4 = grid.map((row) => [...row]);
      newGrid4[r][c] = 4;
      totalScore += 0.1 * expectimaxSearch(newGrid4, depth - 1, true);
    }

    return totalScore / sampleSize;
  }
};

const getBestMove = (grid: Grid): "left" | "right" | "up" | "down" | null => {
  const directions: ("left" | "right" | "up" | "down")[] = [
    "left",
    "right",
    "up",
    "down",
  ];
  let bestScore = -Infinity;
  let bestMove: "left" | "right" | "up" | "down" | null = null;

  // Use depth-2 expectimax search
  const searchDepth = 2;

  for (const dir of directions) {
    const { newGrid, changed } = moveGrid(grid, dir);
    if (changed) {
      const score = expectimaxSearch(newGrid, searchDepth, false);
      if (score > bestScore) {
        bestScore = score;
        bestMove = dir;
      }
    }
  }

  return bestMove;
};

const getTileColor = (value: number, isDark: boolean) => {
  const colors: Record<number, { bg: string; text: string }> = {
    0: { bg: isDark ? "#3c3a32" : "#cdc1b4", text: "transparent" },
    2: { bg: "#eee4da", text: "#776e65" },
    4: { bg: "#ede0c8", text: "#776e65" },
    8: { bg: "#f2b179", text: "#f9f6f2" },
    16: { bg: "#f59563", text: "#f9f6f2" },
    32: { bg: "#f67c5f", text: "#f9f6f2" },
    64: { bg: "#f65e3b", text: "#f9f6f2" },
    128: { bg: "#edcf72", text: "#f9f6f2" },
    256: { bg: "#edcc61", text: "#f9f6f2" },
    512: { bg: "#edc850", text: "#f9f6f2" },
    1024: { bg: "#edc53f", text: "#f9f6f2" },
    2048: { bg: "#edc22e", text: "#f9f6f2" },
  };
  return colors[value] || { bg: "#3c3a32", text: "#f9f6f2" };
};

export default function Game2048() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [grid, setGrid] = useState<Grid>(initGame());
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    return parseInt(localStorage.getItem("tooldock_2048_best") || "0");
  });
  const [status, setStatus] = useState<GameStatus>("playing");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [wonContinue, setWonContinue] = useState(false);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem("tooldock_2048_best", score.toString());
    }
  }, [score, bestScore]);

  const handleMove = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      if (status === "over") return;

      const { newGrid, score: moveScore, changed } = moveGrid(grid, direction);

      if (changed) {
        const gridWithSpawn = spawnTile(newGrid);
        setGrid(gridWithSpawn);
        setScore((prev) => prev + moveScore);

        if (
          gridWithSpawn.some((row) => row.includes(2048)) &&
          status !== "won" &&
          !wonContinue
        ) {
          setStatus("won");
        } else if (!canMove(gridWithSpawn)) {
          setStatus("over");
        }
      }
    },
    [grid, status]
  );

  // AI Logic Loop
  useEffect(() => {
    if (aiEnabled && status === "playing") {
      const timer = setTimeout(() => {
        const move = getBestMove(grid);
        if (move) {
          handleMove(move);
        } else {
          setAiEnabled(false);
        }
      }, 300); // Slightly slower interval for better observation
      return () => clearTimeout(timer);
    }
  }, [aiEnabled, grid, status, handleMove]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (aiEnabled) return; // Disable keys when AI is active
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          handleMove("left");
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          handleMove("right");
          break;
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          handleMove("up");
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          handleMove("down");
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleMove, aiEnabled]);

  const resetGame = () => {
    setGrid(initGame());
    setScore(0);
    setStatus("playing");
    setWonContinue(false);
  };

  const handleContinue = () => {
    setStatus("playing");
    setWonContinue(true);
  };

  return (
    <ToolLayout title={t("tools.game2048.name")}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={4} alignItems="center">
          {/* Header */}
          <Box sx={{ width: "100%", maxWidth: 500 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography
                variant="h3"
                fontWeight="bold"
                sx={{ color: isDark ? "#fff" : "#776e65" }}
              >
                2048
              </Typography>
              <Stack direction="row" spacing={2}>
                <Paper
                  sx={{
                    p: 1.5,
                    minWidth: 80,
                    textAlign: "center",
                    bgcolor: isDark ? "#3c3a32" : "#bbada0",
                    color: "#fff",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ opacity: 0.8, display: "block" }}
                  >
                    {t("tools.game2048.score")}
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {score}
                  </Typography>
                </Paper>
                <Paper
                  sx={{
                    p: 1.5,
                    minWidth: 80,
                    textAlign: "center",
                    bgcolor: isDark ? "#3c3a32" : "#bbada0",
                    color: "#fff",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ opacity: 0.8, display: "block" }}
                  >
                    {t("tools.game2048.best_score")}
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {bestScore}
                  </Typography>
                </Paper>
              </Stack>
            </Stack>

            <Stack
              direction="row"
              spacing={2}
              sx={{ mt: 2 }}
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={aiEnabled}
                      onChange={(e) => setAiEnabled(e.target.checked)}
                      color="secondary"
                    />
                  }
                  label={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <AiIcon size={16} />
                      <Typography variant="body2" fontWeight="medium">
                        {t("tools.game2048.ai_auto_play")}
                      </Typography>
                    </Stack>
                  }
                />
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <InstructionsDialog
                  title={t("tools.game2048.instructions.title")}
                  steps={[
                    {
                      title: t("tools.game2048.instructions.step1_title"),
                      description: t("tools.game2048.instructions.step1_desc"),
                    },
                    {
                      title: t("tools.game2048.instructions.step2_title"),
                      description: t("tools.game2048.instructions.step2_desc"),
                    },
                    {
                      title: t("tools.game2048.instructions.step3_title"),
                      description: t("tools.game2048.instructions.step3_desc"),
                    },
                    {
                      title: t("tools.game2048.instructions.step4_title"),
                      description: t("tools.game2048.instructions.step4_desc"),
                    },
                  ]}
                />
                <Button
                  variant="contained"
                  startIcon={<ResetIcon size={18} />}
                  onClick={resetGame}
                  sx={{
                    bgcolor: "#8f7a66",
                    "&:hover": { bgcolor: "#7f6a56" },
                    textTransform: "none",
                    fontWeight: "bold",
                  }}
                >
                  {t("tools.game2048.new_game")}
                </Button>
              </Stack>
            </Stack>
          </Box>

          {/* Game Board */}
          <Paper
            elevation={4}
            sx={{
              p: 1.5,
              bgcolor: isDark ? "#2a2a2a" : "#bbada0",
              borderRadius: 2,
              position: "relative",
              userSelect: "none",
              touchAction: "none",
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                gap: 1.5,
                width: { xs: 280, sm: 400 },
                height: { xs: 280, sm: 400 },
              }}
            >
              {grid.map((row, r) =>
                row.map((val, c) => (
                  <Box
                    key={`${r}-${c}`}
                    sx={{
                      width: "100%",
                      height: "100%",
                      borderRadius: 1,
                      bgcolor: isDark ? "#3c3a32" : "#cdc1b4", // Empty cell background
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                    }}
                  >
                    <AnimatePresence>
                      {val !== 0 && (
                        <motion.div
                          key={`tile-${r}-${c}-${val}`}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 20,
                          }}
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: "4px",
                            backgroundColor: getTileColor(val, isDark).bg,
                            color: getTileColor(val, isDark).text,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize:
                              val < 100 ? "32px" : val < 1000 ? "24px" : "18px",
                            fontWeight: "bold",
                            position: "absolute",
                            top: 0,
                            left: 0,
                            zIndex: 1,
                          }}
                        >
                          {val}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Box>
                ))
              )}
            </Box>

            {/* Overlays */}
            <AnimatePresence>
              {status !== "playing" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(238, 228, 218, 0.73)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "8px",
                    zIndex: 10,
                  }}
                >
                  <Typography
                    variant="h3"
                    fontWeight="bold"
                    sx={{ color: "#776e65", mb: 3 }}
                  >
                    {status === "won"
                      ? t("tools.game2048.game_win")
                      : t("tools.game2048.game_over")}
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained"
                      onClick={resetGame}
                      sx={{
                        bgcolor: "#8f7a66",
                        "&:hover": { bgcolor: "#7f6a56" },
                        textTransform: "none",
                        fontWeight: "bold",
                        py: 1.5,
                        px: 3,
                      }}
                    >
                      {t("tools.game2048.try_again")}
                    </Button>
                    {status === "won" && (
                      <Button
                        variant="contained"
                        onClick={handleContinue}
                        sx={{
                          bgcolor: "#8f7a66",
                          "&:hover": { bgcolor: "#7f6a56" },
                          textTransform: "none",
                          fontWeight: "bold",
                          py: 1.5,
                          px: 3,
                        }}
                      >
                        {t("tools.game2048.keep_going")}
                      </Button>
                    )}
                  </Stack>
                </motion.div>
              )}
            </AnimatePresence>
          </Paper>

        </Stack>
      </Container>
    </ToolLayout>
  );
}
