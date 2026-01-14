use crate::core::notepad_db::{NotepadDb, Task as DbTask};
use crate::models::ApiResponse;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TaskType {
    TodayPlan,
    ShortTerm,
    LongTerm,
    Memo,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RecurrenceType {
    None,
    Daily,
    Workdays,
    CustomRange,
    FixedDate,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub content: String,
    pub task_type: TaskType,
    pub created_at: i64,

    // Short Term
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,

    // Long Term
    pub recurrence_pattern: Option<RecurrenceType>,
    pub recurrence_start: Option<i64>,
    pub recurrence_end: Option<i64>,
    pub recurrence_fixed_date: Option<i64>,

    // Common
    pub reminder_time: Option<i64>,
    pub is_completed: bool,
    pub images: Vec<String>,
    #[serde(default)]
    pub reminder_notified: Option<bool>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct NoteData {
    pub tasks: Vec<Task>,
}

// 数据库状态管理
pub struct NotepadDbState(pub Mutex<Option<NotepadDb>>);

fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    }

    Ok(app_data_dir.join("tooldock.db"))
}

fn get_json_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data_dir.join("tooldock_data.json"))
}

fn get_images_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let images_dir = app_data_dir.join("tooldock_images");

    if !images_dir.exists() {
        fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;
    }

    Ok(images_dir)
}

// Task 转换为 DbTask
fn task_to_db(task: &Task) -> DbTask {
    let task_type_str = match task.task_type {
        TaskType::TodayPlan => "todayPlan",
        TaskType::ShortTerm => "shortTerm",
        TaskType::LongTerm => "longTerm",
        TaskType::Memo => "memo",
    };

    let recurrence_pattern = task.recurrence_pattern.as_ref().map(|p| {
        match p {
            RecurrenceType::None => "none",
            RecurrenceType::Daily => "daily",
            RecurrenceType::Workdays => "workdays",
            RecurrenceType::CustomRange => "customRange",
            RecurrenceType::FixedDate => "fixedDate",
        }
        .to_string()
    });

    DbTask {
        id: task.id.clone(),
        title: task.title.clone(),
        content: task.content.clone(),
        task_type: task_type_str.to_string(),
        created_at: task.created_at,
        start_time: task.start_time,
        end_time: task.end_time,
        recurrence_pattern,
        recurrence_start: task.recurrence_start,
        recurrence_end: task.recurrence_end,
        recurrence_fixed_date: task.recurrence_fixed_date,
        reminder_time: task.reminder_time,
        is_completed: task.is_completed,
        images: serde_json::to_string(&task.images).unwrap_or_else(|_| "[]".to_string()),
        reminder_notified: task.reminder_notified,
        tags: task
            .tags
            .as_ref()
            .map(|t| serde_json::to_string(t).unwrap_or_else(|_| "null".to_string())),
    }
}

// DbTask 转换为 Task
fn db_to_task(db_task: &DbTask) -> Task {
    let task_type = match db_task.task_type.as_str() {
        "todayPlan" => TaskType::TodayPlan,
        "shortTerm" => TaskType::ShortTerm,
        "longTerm" => TaskType::LongTerm,
        "memo" => TaskType::Memo,
        _ => TaskType::Memo,
    };

    let recurrence_pattern = db_task
        .recurrence_pattern
        .as_ref()
        .map(|p| match p.as_str() {
            "none" => RecurrenceType::None,
            "daily" => RecurrenceType::Daily,
            "workdays" => RecurrenceType::Workdays,
            "customRange" => RecurrenceType::CustomRange,
            "fixedDate" => RecurrenceType::FixedDate,
            _ => RecurrenceType::None,
        });

    Task {
        id: db_task.id.clone(),
        title: db_task.title.clone(),
        content: db_task.content.clone(),
        task_type,
        created_at: db_task.created_at,
        start_time: db_task.start_time,
        end_time: db_task.end_time,
        recurrence_pattern,
        recurrence_start: db_task.recurrence_start,
        recurrence_end: db_task.recurrence_end,
        recurrence_fixed_date: db_task.recurrence_fixed_date,
        reminder_time: db_task.reminder_time,
        is_completed: db_task.is_completed,
        images: serde_json::from_str(&db_task.images).unwrap_or_default(),
        reminder_notified: db_task.reminder_notified,
        tags: db_task
            .tags
            .as_ref()
            .and_then(|t| serde_json::from_str(t).ok()),
    }
}

// 从 JSON 迁移到数据库
fn migrate_from_json(app: &AppHandle, db: &NotepadDb) -> Result<(), String> {
    let json_path = get_json_path(app)?;

    if !json_path.exists() {
        return Ok(());
    }



    let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let note_data: NoteData = serde_json::from_str(&content).map_err(|e| e.to_string())?;



    let db_tasks: Vec<DbTask> = note_data.tasks.iter().map(task_to_db).collect();
    db.save_tasks(&db_tasks).map_err(|e| e.to_string())?;

    // 迁移成功后重命名 JSON 文件作为备份
    let backup_path = json_path.with_extension("json.migrated");
    fs::rename(&json_path, &backup_path).map_err(|e| e.to_string())?;



    Ok(())
}

#[tauri::command]
pub async fn save_notepad_image(
    app: AppHandle,
    file_name: String,
    data: Vec<u8>,
) -> ApiResponse<String> {
    let dir = match get_images_dir(&app) {
        Ok(d) => d,
        Err(e) => return ApiResponse::error(e, "tools.notepad.save_image_error"),
    };

    let path = dir.join(&file_name);
    match fs::write(&path, data) {
        Ok(_) => ApiResponse::ok(path.to_string_lossy().to_string()),
        Err(e) => ApiResponse::error(e.to_string(), "tools.notepad.save_image_error"),
    }
}

#[tauri::command]
pub fn load_notepad_data(app: AppHandle, db_state: State<NotepadDbState>) -> ApiResponse<NoteData> {
    let mut db_guard = db_state.0.lock().unwrap();

    // 初始化数据库（如果还没初始化）
    if db_guard.is_none() {
        let db_path = match get_db_path(&app) {
            Ok(p) => p,
            Err(e) => return ApiResponse::error(e, "tools.notepad.db_error"),
        };



        let db = match NotepadDb::new(db_path) {
            Ok(d) => d,
            Err(e) => return ApiResponse::error(e.to_string(), "tools.notepad.db_init_error"),
        };

        // 尝试从 JSON 迁移
        if let Err(_e) = migrate_from_json(&app, &db) {

        }

        *db_guard = Some(db);
    }

    let db = db_guard.as_ref().unwrap();

    match db.load_all_tasks() {
        Ok(db_tasks) => {
            let tasks: Vec<Task> = db_tasks.iter().map(db_to_task).collect();

            ApiResponse::ok(NoteData { tasks })
        }
        Err(e) => ApiResponse::error(e.to_string(), "tools.notepad.load_error"),
    }
}

#[tauri::command]
pub fn save_notepad_data(db_state: State<NotepadDbState>, data: NoteData) -> ApiResponse<()> {
    let db_guard = db_state.0.lock().unwrap();

    if db_guard.is_none() {
        return ApiResponse::error(
            "Database not initialized".to_string(),
            "tools.notepad.db_error",
        );
    }

    let db = db_guard.as_ref().unwrap();



    let db_tasks: Vec<DbTask> = data.tasks.iter().map(task_to_db).collect();

    match db.save_tasks(&db_tasks) {
        Ok(_) => {

            ApiResponse::ok(())
        }
        Err(e) => {

            ApiResponse::error(e.to_string(), "tools.notepad.save_error")
        }
    }
}
