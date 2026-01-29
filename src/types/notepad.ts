
export enum TaskType {
  TodayPlan = "todayPlan",
  ShortTerm = "shortTerm",
  LongTerm = "longTerm",
  Memo = "memo",
}

export enum RecurrenceType {
  None = "none",
  Daily = "daily",
  Workdays = "workdays",
  CustomRange = "customRange",
  FixedDate = "fixedDate",
}

export interface Task {
  id: string;
  title: string;
  content: string;
  taskType: TaskType;
  createdAt: number;

  // Short Term
  startTime?: number;
  endTime?: number;

  // Long Term
  recurrencePattern?: RecurrenceType;
  recurrenceStart?: number;
  recurrenceEnd?: number;
  recurrenceFixedDate?: number;

  // Common
  reminderTime?: number;
  isCompleted: boolean;
  images: string[];
  attachments?: string[]; // Support any file format
  reminderNotified?: boolean;
  tags?: string[];
}

export interface NoteData {
  tasks: Task[];
  dailyMemo?: {
    content: string;
    date: string; // YYYY-MM-DD format, used to check if should clear
  };
}

export interface PomodoroSession {
  id: string;
  taskId?: string;
  taskTitle?: string;
  completedAt: number;
  duration: number; // in seconds
  mode: "work" | "break";
}

export interface PomodoroSettings {
  workDuration: number; // in minutes
  breakDuration: number; // in minutes
  soundEnabled: boolean;
}
