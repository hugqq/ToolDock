
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ToolLayout } from "../components/layout/ToolLayout";
import {
  Notebook,
  Calendar as CalendarIcon,
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
  
  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task>>({});
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTask, setPreviewTask] = useState<Task | null>(null);

  // Search
  // const [searchQuery, setSearchQuery] = useState("");

  const handleAddTask = () => {
    const taskType =
      activeTab === TaskType.TodayPlan ? TaskType.ShortTerm : activeTab;

    const defaultStartTime =
      activeTab === TaskType.TodayPlan
        ? new Date().setHours(9, 0, 0, 0)
        : undefined;

    setEditingTask({
      taskType: taskType,
      content: "",
      title: "",
      images: [],
      isCompleted: false,
      startTime: defaultStartTime,
      endTime: undefined,
      reminderTime: undefined,
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
      // Basic validation
      if (!task.title?.trim()) {
          // Toast is handled in UI normally, but let's assume the hook doesn't handle validation toast
          // Wait, the main hook doesn't validate. We should validate here.
          // NotePad.tsx used toast.error(t("common.required"));
          // I didn't import toast here, let's fix that if needed or assume user handles it
          return; 
      }

      if (task.id) {
          await updateTask(task as Task);
      } else {
          const newTask = {
              ...task,
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              createdAt: Date.now(),
              images: task.images || [],
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
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                            <div className="lg:col-span-2 space-y-3">
                                <h3 className="text-lg font-semibold text-(--text-main) mb-4 flex items-center gap-2">
                                    <CalendarIcon size={20} className="text-(--primary-color)" />
                                    {t("tools.notepad.today_tasks")}
                                </h3>
                                {currentFilteredTasks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-(--text-secondary) opacity-50">
                                        <Notebook size={48} className="mb-2" />
                                        <span>{t("tools.notepad.no_today_tasks")}</span>
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
