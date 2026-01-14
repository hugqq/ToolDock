import { useState, useRef, useCallback, useEffect } from "react";
import { PomodoroSession, PomodoroSettings } from "../types/notepad";
import { sendNotification } from "@tauri-apps/plugin-notification";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

export function usePomodoro() {
  const { t } = useTranslation();
  const [time, setTime] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<"work" | "break">("work");
  const [settings, setSettings] = useState<PomodoroSettings>({
    workDuration: 25,
    breakDuration: 5,
    soundEnabled: true,
  });
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playBeepSound = useCallback(() => {
    if (!settings.soundEnabled) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      
      // 第一个音："叮" (E5 - 659Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      osc1.frequency.value = 659; // E5
      osc1.type = "sine";
      
      gain1.gain.setValueAtTime(0, ctx.currentTime);
      gain1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.6);
      
      // 第二个音："咚" (C5 - 523Hz)，延迟0.15秒
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc2.frequency.value = 523; // C5
      osc2.type = "sine";
      
      const startTime2 = ctx.currentTime + 0.15;
      gain2.gain.setValueAtTime(0, startTime2);
      gain2.gain.linearRampToValueAtTime(0.25, startTime2 + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.01, startTime2 + 0.7);
      
      osc2.start(startTime2);
      osc2.stop(startTime2 + 0.7);
    } catch (e) {
      console.error("Failed to play sound:", e);
    }
  }, [settings.soundEnabled]);

  const handleTimerComplete = useCallback((currentMode: "work"|"break", currentSettings: PomodoroSettings, focusedTaskId: string | null, focusedTaskTitle?: string) => {
    setIsRunning(false);
    playBeepSound();

    sendNotification({
      title: t("tools.notepad.pomodoro"),
      body: currentMode === "work"
          ? t("tools.notepad.break_time")
          : t("tools.notepad.start_focus"),
    });

    const newSession: PomodoroSession = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      taskId: focusedTaskId || undefined,
      taskTitle: focusedTaskTitle,
      completedAt: Date.now(),
      duration: currentMode === "work"
        ? currentSettings.workDuration * 60
        : currentSettings.breakDuration * 60,
      mode: currentMode,
    };

    setSessions((prev) => [newSession, ...prev].slice(0, 50));

    if (currentMode === "work") {
      setMode("break");
      setTime(currentSettings.breakDuration * 60);
    } else {
      setMode("work");
      setTime(currentSettings.workDuration * 60);
    }
    toast.success(t("tools.notepad.pomodoro") + " " + t("common.success"));
  }, [playBeepSound, t]);

  // We need to pass dependencies to the timer effect that can change, but be careful with closures.
  // Using refs for values that change inside the interval but shouldn't trigger re-creation of the interval might be better,
  // OR just react to state changes.
  
  // Actually, to avoid closure staleness, we can use functional updates for setTime.
  // But we need access to 'mode', 'settings', 'focusedTaskId' when timer hits 0.
  // Simplest is to check 0 inside the effect.

  // NOTE: External components need to pass `focusedTaskId` and `focusedTaskTitle` to `usePomodoro` or we keep it here.
  // Let's keep a ref to them here if we want the timer to access them without restarting.
  const focusedTaskRef = useRef<{id: string | null, title?: string}>({id: null});

  const updateFocusedTask = (id: string | null, title?: string) => {
      focusedTaskRef.current = {id, title};
  }

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTime((prev) => {
          if (prev <= 0) {
             // Timer complete
             // We need to call handleTimerComplete but we can't easily do it inside the setState callback cleanly if it has side effects.
             // So we return 0, and use another effect to trigger completion? 
             // Or just do it here? Functional update shouldn't have side effects strictly speaking but common in React.
             // Better: check inside interval before functional update?
             return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Monitor time to trigger completion
  useEffect(() => {
      if (isRunning && time <= 0) {
          handleTimerComplete(mode, settings, focusedTaskRef.current.id, focusedTaskRef.current.title);
      }
  }, [time, isRunning, mode, settings, handleTimerComplete]);


  const toggleTimer = () => setIsRunning(!isRunning);
  
  const resetTimer = () => {
      setIsRunning(false);
      setTime(mode === "work" ? settings.workDuration * 60 : settings.breakDuration * 60);
  }

  // Update time when settings change (if not running)
  useEffect(() => {
     if(!isRunning) {
         setTime(mode === "work" ? settings.workDuration * 60 : settings.breakDuration * 60);
     }
  }, [settings.workDuration, settings.breakDuration, mode]);

  return {
    time,
    isRunning,
    mode,
    settings,
    setSettings,
    sessions,
    toggleTimer,
    resetTimer,
    playBeepSound,
    updateFocusedTask,
    notificationPermission: "default" // Placeholder if needed, logic is in main hook
  };
}
