
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ToolLayout } from "../components/layout/ToolLayout";
import {
  Notebook,
  Plus,
  Circle,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { useNotePadData } from "../hooks/useNotePadData";
import { usePomodoro } from "../hooks/usePomodoro";
import { TaskType, Task, RecurrenceType } from "../types/notepad";

import { PomodoroTimer } from "./notepad/PomodoroTimer";
import { TaskFilters } from "./notepad/TaskFilters";
import { TaskCard } from "./notepad/TaskCard";
import { TaskEditor } from "./notepad/TaskEditor";
import { TaskPreview } from "./notepad/TaskPreview";

export default function NotePad() {
  const { t } = useTranslation();
  const {
      tasks,
      notificationPermission,
      addTask,
      updateTask,
      deleteTask,
      toggleTask,
      testNotification,
      filteredTasks
  } = useNotePadData();

  const pomodoro = usePomodoro();

  const [activeTab, setActiveTab] = useState<TaskType>(TaskType.TodayPlan);

  // Quick task input for Today Plan
  const [quickTaskInput, setQuickTaskInput] = useState("");

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task>>({});

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTask, setPreviewTask] = useState<Task | null>(null);

  // Get today's date string for display
  const getTodayDateString = () => {
    const now = new Date();
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;
  };

  // Filter tasks for today
  const todayTasks = tasks.filter(task => {
    if (task.taskType !== TaskType.TodayPlan) return false;
    const today = new Date();
    const taskDate = new Date(task.createdAt);
    return taskDate.toDateString() === today.toDateString();
  });

  // Quick add task for Today Plan
  const handleQuickAddTask = async () => {
    if (!quickTaskInput.trim()) return;

    const newTask: Task = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
      taskType: TaskType.TodayPlan,
      content: quickTaskInput.trim(),
      title: "",
      images: [],
      attachments: [],
      isCompleted: false,
      createdAt: Date.now(),
      recurrencePattern: RecurrenceType.None,
    };

    await addTask(newTask);
    setQuickTaskInput("");
  };

  const handleAddTask = () => {
    const taskType =
      activeTab === TaskType.TodayPlan ? TaskType.ShortTerm : activeTab;

    // Default start time: current hour, rounded to next hour
    const now = new Date();
    const defaultStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0).getTime();
    // Default end time: 1 hour after start time
    const defaultEndTime = defaultStartTime + 60 * 60 * 1000;

    // Default reminder time is 1 hour from now
    const defaultReminderTime = Date.now() + 60 * 60 * 1000;

    setEditingTask({
      taskType: taskType,
      content: "",
      title: "",
      images: [],
      attachments: [],
      isCompleted: false,
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      reminderTime: defaultReminderTime,
      recurrencePattern: RecurrenceType.None,
      createdAt: Date.now(),
    });
    setIsEditorOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask({ ...task });
    setIsEditorOpen(true);
  };

  const handleSaveTask = async (task: Partial<Task>) => {
      // Basic validation - check content instead of title
      if (!task.content?.trim()) {
          return;
      }

      if (task.id) {
          await updateTask(task as Task);
      } else {
          const newTask = {
              ...task,
              id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
              createdAt: Date.now(),
              images: task.images || [],
              attachments: task.attachments || [],
              isCompleted: false,
          } as Task;
          await addTask(newTask);
      }
      setIsEditorOpen(false);
  };

  const currentFilteredTasks = filteredTasks(activeTab);

  return (
    <ToolLayout title={t("tools.notepad.name")}>
      <div className="flex flex-col h-full overflow-hidden pb-4">
        {/* Main Content */}
        <div className="flex flex-col h-full bg-(--card-bg) rounded-xl border border-(--border-color) shadow-sm overflow-hidden">
          
          <TaskFilters 
            activeTab={activeTab} 
            onChangeTab={setActiveTab} 
            onAddTask={handleAddTask} 
          />

          <div className="flex-1 overflow-hidden relative">
             <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="h-full w-full overflow-y-auto p-4"
                >
                     {activeTab === TaskType.TodayPlan ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                            <div className="lg:col-span-1">
                                <PomodoroTimer
                                    {...pomodoro}
                                    tasks={tasks}
                                    onToggleTimer={pomodoro.toggleTimer}
                                    onResetTimer={pomodoro.resetTimer}
                                    onUpdateSettings={pomodoro.setSettings}
                                    onUpdateFocusedTask={pomodoro.updateFocusedTask}
                                    onTestSound={pomodoro.playBeepSound}
                                    notificationPermission={notificationPermission}
                                    onTestNotification={testNotification}
                                />
                            </div>
                            <div className="lg:col-span-2 flex flex-col">
                                {/* Today's Task List - Microsoft To-Do Style */}
                                <div className="bg-(--bg-main) rounded-lg border border-(--border-color) flex-1 flex flex-col overflow-hidden">
                                    {/* Date Header */}
                                    <div className="p-4 border-b border-(--border-color)">
                                        <h2 className="text-lg font-semibold text-(--text-main)">{getTodayDateString()}</h2>
                                    </div>

                                    {/* Task List */}
                                    <div className="flex-1 overflow-y-auto p-2">
                                        {todayTasks.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-32 text-(--text-secondary) opacity-50">
                                                <Notebook size={32} className="mb-2" />
                                                <span>{t("tools.notepad.no_today_tasks")}</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {todayTasks.map(task => (
                                                    <div
                                                        key={task.id}
                                                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-(--bg-hover) group transition-colors"
                                                    >
                                                        <button
                                                            onClick={() => toggleTask(task.id)}
                                                            className="flex-shrink-0 text-(--text-secondary) hover:text-(--primary-color) transition-colors"
                                                        >
                                                            {task.isCompleted ? (
                                                                <CheckCircle2 size={22} className="text-(--primary-color)" />
                                                            ) : (
                                                                <Circle size={22} />
                                                            )}
                                                        </button>
                                                        <span className={`flex-1 min-w-0 text-(--text-main) break-all ${task.isCompleted ? 'line-through opacity-50' : ''}`}>
                                                            {task.content}
                                                        </span>
                                                        <button
                                                            onClick={() => deleteTask(task.id)}
                                                            className="opacity-0 group-hover:opacity-100 text-(--text-secondary) hover:text-red-500 transition-all"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick Add Input */}
                                    <div className="p-3 border-t border-(--border-color)">
                                        <div className="flex items-center gap-3 p-2 rounded-lg bg-(--bg-secondary) border border-(--border-color) focus-within:border-(--primary-color) transition-colors">
                                            <Plus size={20} className="text-(--text-secondary) flex-shrink-0" />
                                            <input
                                                type="text"
                                                value={quickTaskInput}
                                                onChange={(e) => setQuickTaskInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                                        handleQuickAddTask();
                                                    }
                                                }}
                                                placeholder={t("tools.notepad.todo_placeholder") || "添加新任务..."}
                                                className="flex-1 bg-transparent border-none outline-none text-(--text-main) placeholder:text-(--text-secondary)"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                     ) : (
                         <div className="space-y-3 max-w-4xl mx-auto">
                            {/* We could add search here if needed */}
                             {currentFilteredTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-(--text-secondary) opacity-50">
                                    <Notebook size={48} className="mb-2" />
                                    <span>{t("common.no_results")}</span>
                                </div>
                             ) : (
                                currentFilteredTasks.map(task => (
                                    <TaskCard 
                                        key={task.id} 
                                        task={task} 
                                        onToggle={toggleTask} 
                                        onDelete={deleteTask}
                                        onEdit={handleEditTask}
                                        onPreview={(t) => {
                                            setPreviewTask(t);
                                            setIsPreviewOpen(true);
                                        }}
                                    />
                                ))
                             )}
                         </div>
                     )}
                </motion.div>
             </AnimatePresence>
          </div>
        </div>
      </div>

      <TaskEditor 
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        initialTask={editingTask}
        activeTab={activeTab}
        onSave={handleSaveTask}
      />

      <TaskPreview 
        isOpen={isPreviewOpen}
        task={previewTask}
        onClose={() => {
            setIsPreviewOpen(false);
            setPreviewTask(null);
        }}
      />
    </ToolLayout>
  );
}
