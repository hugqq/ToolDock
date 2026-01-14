// src-tauri/src/core/notepad_db.rs
use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub content: String,
    pub task_type: String,
    pub created_at: i64,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub recurrence_pattern: Option<String>,
    pub recurrence_start: Option<i64>,
    pub recurrence_end: Option<i64>,
    pub recurrence_fixed_date: Option<i64>,
    pub reminder_time: Option<i64>,
    pub is_completed: bool,
    pub images: String, // JSON array
    pub reminder_notified: Option<bool>,
    pub tags: Option<String>, // JSON array
}

pub struct NotepadDb {
    conn: Connection,
}

impl NotepadDb {
    /// 创建或打开数据库
    pub fn new<P: AsRef<Path>>(db_path: P) -> SqlResult<Self> {
        let conn = Connection::open(db_path)?;
        let db = NotepadDb { conn };
        db.init_schema()?;
        Ok(db)
    }

    /// 初始化表结构
    fn init_schema(&self) -> SqlResult<()> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS notepad (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                task_type TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                start_time INTEGER,
                end_time INTEGER,
                recurrence_pattern TEXT,
                recurrence_start INTEGER,
                recurrence_end INTEGER,
                recurrence_fixed_date INTEGER,
                reminder_time INTEGER,
                is_completed INTEGER NOT NULL DEFAULT 0,
                images TEXT NOT NULL DEFAULT '[]',
                reminder_notified INTEGER,
                tags TEXT
            )",
            [],
        )?;
        Ok(())
    }

    /// 加载所有任务
    pub fn load_all_tasks(&self) -> SqlResult<Vec<Task>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, content, task_type, created_at, 
                    start_time, end_time, recurrence_pattern, 
                    recurrence_start, recurrence_end, recurrence_fixed_date,
                    reminder_time, is_completed, images, reminder_notified, tags
             FROM notepad 
             ORDER BY created_at DESC",
        )?;

        let tasks = stmt
            .query_map([], |row| {
                Ok(Task {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    task_type: row.get(3)?,
                    created_at: row.get(4)?,
                    start_time: row.get(5)?,
                    end_time: row.get(6)?,
                    recurrence_pattern: row.get(7)?,
                    recurrence_start: row.get(8)?,
                    recurrence_end: row.get(9)?,
                    recurrence_fixed_date: row.get(10)?,
                    reminder_time: row.get(11)?,
                    is_completed: row.get::<_, i32>(12)? != 0,
                    images: row.get(13)?,
                    reminder_notified: row.get::<_, Option<i32>>(14)?.map(|v| v != 0),
                    tags: row.get(15)?,
                })
            })?
            .collect::<SqlResult<Vec<_>>>()?;

        Ok(tasks)
    }

    /// 保存或更新任务（使用 UPSERT）
    pub fn save_task(&self, task: &Task) -> SqlResult<()> {
        self.conn.execute(
            "INSERT INTO notepad (
                id, title, content, task_type, created_at,
                start_time, end_time, recurrence_pattern,
                recurrence_start, recurrence_end, recurrence_fixed_date,
                reminder_time, is_completed, images, reminder_notified, tags
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                task_type = excluded.task_type,
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                recurrence_pattern = excluded.recurrence_pattern,
                recurrence_start = excluded.recurrence_start,
                recurrence_end = excluded.recurrence_end,
                recurrence_fixed_date = excluded.recurrence_fixed_date,
                reminder_time = excluded.reminder_time,
                is_completed = excluded.is_completed,
                images = excluded.images,
                reminder_notified = excluded.reminder_notified,
                tags = excluded.tags",
            params![
                task.id,
                task.title,
                task.content,
                task.task_type,
                task.created_at,
                task.start_time,
                task.end_time,
                task.recurrence_pattern,
                task.recurrence_start,
                task.recurrence_end,
                task.recurrence_fixed_date,
                task.reminder_time,
                task.is_completed as i32,
                task.images,
                task.reminder_notified.map(|v| v as i32),
                task.tags,
            ],
        )?;
        Ok(())
    }

    /// 批量保存任务（事务）
    pub fn save_tasks(&self, tasks: &[Task]) -> SqlResult<()> {
        let tx = self.conn.unchecked_transaction()?;

        // 先删除所有现有任务
        tx.execute("DELETE FROM notepad", [])?;

        // 然后插入新任务
        for task in tasks {
            tx.execute(
                "INSERT INTO notepad (
                    id, title, content, task_type, created_at,
                    start_time, end_time, recurrence_pattern,
                    recurrence_start, recurrence_end, recurrence_fixed_date,
                    reminder_time, is_completed, images, reminder_notified, tags
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
                params![
                    task.id,
                    task.title,
                    task.content,
                    task.task_type,
                    task.created_at,
                    task.start_time,
                    task.end_time,
                    task.recurrence_pattern,
                    task.recurrence_start,
                    task.recurrence_end,
                    task.recurrence_fixed_date,
                    task.reminder_time,
                    task.is_completed as i32,
                    task.images,
                    task.reminder_notified.map(|v| v as i32),
                    task.tags,
                ],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    /// 删除任务
    pub fn delete_task(&self, id: &str) -> SqlResult<()> {
        self.conn
            .execute("DELETE FROM notepad WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// 清空所有任务
    pub fn clear_all(&self) -> SqlResult<()> {
        self.conn.execute("DELETE FROM notepad", [])?;
        Ok(())
    }
}
