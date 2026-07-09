use crate::core::http_client::build_history_projection;
use crate::models::http_client::HttpHistoryEntry;
use rusqlite::{params, Connection};
use std::path::Path;
use thiserror::Error;

const HISTORY_LIMIT: i64 = 100;

#[derive(Debug, Error)]
pub enum HttpHistoryError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("History serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub struct HttpHistoryDb {
    conn: Connection,
}

impl HttpHistoryDb {
    pub fn new<P: AsRef<Path>>(db_path: P) -> Result<Self, HttpHistoryError> {
        let conn = Connection::open(db_path)?;
        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<(), HttpHistoryError> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS http_history (
                id TEXT PRIMARY KEY,
                request_json TEXT NOT NULL,
                response_status INTEGER NOT NULL,
                duration_ms INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_http_history_created_at
             ON http_history(created_at DESC)",
            [],
        )?;
        Ok(())
    }

    pub fn save(&self, entry: &HttpHistoryEntry) -> Result<(), HttpHistoryError> {
        let safe_request = build_history_projection(&entry.request);
        let request_json = serde_json::to_string(&safe_request)?;
        let tx = self.conn.unchecked_transaction()?;
        tx.execute(
            "INSERT OR REPLACE INTO http_history
             (id, request_json, response_status, duration_ms, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                entry.id,
                request_json,
                entry.response_status,
                entry.duration_ms,
                entry.created_at,
            ],
        )?;
        tx.execute(
            "DELETE FROM http_history WHERE id NOT IN (
                SELECT id FROM http_history
                ORDER BY created_at DESC, rowid DESC
                LIMIT ?1
            )",
            params![HISTORY_LIMIT],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn load_all(&self) -> Result<Vec<HttpHistoryEntry>, HttpHistoryError> {
        let mut statement = self.conn.prepare(
            "SELECT id, request_json, response_status, duration_ms, created_at
             FROM http_history
             ORDER BY created_at DESC, rowid DESC
             LIMIT ?1",
        )?;

        let rows = statement.query_map(params![HISTORY_LIMIT], |row| {
            let request_json: String = row.get(1)?;
            let request = serde_json::from_str(&request_json).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    1,
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            })?;
            Ok(HttpHistoryEntry {
                id: row.get(0)?,
                request,
                response_status: row.get(2)?,
                duration_ms: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(HttpHistoryError::from)
    }

    pub fn delete(&self, id: &str) -> Result<(), HttpHistoryError> {
        self.conn
            .execute("DELETE FROM http_history WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn clear(&self) -> Result<(), HttpHistoryError> {
        self.conn.execute("DELETE FROM http_history", [])?;
        Ok(())
    }
}
