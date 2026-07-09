use std::fs;
use std::path::PathBuf;
use tooldock_lib::core::http_history_db::HttpHistoryDb;
use tooldock_lib::models::http_client::{
    HttpBodyMode, HttpDebugRequest, HttpHistoryEntry, HttpKeyValue, HttpMethod,
};
use uuid::Uuid;

fn temp_db_path() -> PathBuf {
    std::env::temp_dir().join(format!("tooldock-http-history-{}.db", Uuid::new_v4()))
}

fn request(index: i64) -> HttpDebugRequest {
    HttpDebugRequest {
        method: HttpMethod::Post,
        url: format!("https://example.com/{index}"),
        query: vec![],
        headers: vec![HttpKeyValue {
            id: "authorization".into(),
            enabled: true,
            key: "Authorization".into(),
            value: "Bearer private".into(),
        }],
        body_mode: HttpBodyMode::Json,
        body_text: r#"{"name":"ToolDock","apiKey":"private"}"#.into(),
        form_fields: vec![],
        multipart_fields: vec![],
        timeout_ms: 30_000,
    }
}

fn entry(index: i64) -> HttpHistoryEntry {
    HttpHistoryEntry {
        id: format!("request-{index}"),
        request: request(index),
        response_status: 200,
        duration_ms: index as u64,
        created_at: index,
    }
}

#[test]
fn saves_newest_first_and_redacts_secrets() {
    let path = temp_db_path();
    let db = HttpHistoryDb::new(&path).unwrap();
    db.save(&entry(1)).unwrap();
    db.save(&entry(2)).unwrap();

    let history = db.load_all().unwrap();
    assert_eq!(history[0].id, "request-2");
    assert_eq!(history[1].id, "request-1");
    assert_eq!(history[0].request.headers[0].value, "<redacted>");
    assert!(!history[0].request.body_text.contains("private"));

    drop(db);
    let _ = fs::remove_file(path);
}

#[test]
fn keeps_only_the_latest_one_hundred_entries() {
    let path = temp_db_path();
    let db = HttpHistoryDb::new(&path).unwrap();
    for index in 0..105 {
        db.save(&entry(index)).unwrap();
    }

    let history = db.load_all().unwrap();
    assert_eq!(history.len(), 100);
    assert_eq!(history.first().unwrap().id, "request-104");
    assert_eq!(history.last().unwrap().id, "request-5");

    drop(db);
    let _ = fs::remove_file(path);
}

#[test]
fn deletes_one_entry_and_can_clear_all() {
    let path = temp_db_path();
    let db = HttpHistoryDb::new(&path).unwrap();
    db.save(&entry(1)).unwrap();
    db.save(&entry(2)).unwrap();

    db.delete("request-1").unwrap();
    assert_eq!(db.load_all().unwrap().len(), 1);

    db.clear().unwrap();
    assert!(db.load_all().unwrap().is_empty());

    drop(db);
    let _ = fs::remove_file(path);
}
