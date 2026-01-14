use serde::{Deserialize, Serialize};
use similar::{ChangeTag, TextDiff};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffLine {
    pub tag: String, // "insert", "delete", "equal"
    pub content: String,
    pub old_index: Option<usize>,
    pub new_index: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffResult {
    pub lines: Vec<DiffLine>,
}

pub fn compare_text(old: &str, new: &str) -> DiffResult {
    let diff = TextDiff::from_lines(old, new);
    let mut lines = Vec::new();

    for change in diff.iter_all_changes() {
        let tag = match change.tag() {
            ChangeTag::Delete => "delete",
            ChangeTag::Insert => "insert",
            ChangeTag::Equal => "equal",
        };

        lines.push(DiffLine {
            tag: tag.to_string(),
            content: change.value().to_string(),
            old_index: change.old_index(),
            new_index: change.new_index(),
        });
    }

    DiffResult { lines }
}
