use crate::db::history::{
    self, HistoryPaginatedResult, HistoryQueryParams, HistoryRecord,
};

#[tauri::command]
pub fn get_history_records(params: Option<HistoryQueryParams>) -> Result<HistoryPaginatedResult, String> {
    let params = params.unwrap_or_default();
    history::get_history_records(params).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_history_by_id(id: i64) -> Result<Option<HistoryRecord>, String> {
    history::get_history_by_id(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_history(id: i64) -> Result<bool, String> {
    history::delete_history_record(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_multiple_history(ids: Vec<i64>) -> Result<usize, String> {
    history::delete_history_records(&ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_all_history() -> Result<usize, String> {
    history::clear_all_history().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_history(params: Option<HistoryQueryParams>) -> Result<Vec<HistoryRecord>, String> {
    let params = params.unwrap_or_default();
    history::export_history(params).map_err(|e| e.to_string())
}
