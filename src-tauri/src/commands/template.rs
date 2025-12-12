use crate::db::prompt_template::{self, PromptTemplate, TemplateUpdate};

#[tauri::command]
pub fn get_all_templates() -> Result<Vec<PromptTemplate>, String> {
    prompt_template::get_all_templates().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_default_template() -> Result<Option<PromptTemplate>, String> {
    prompt_template::get_default_template().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_recent_templates(limit: Option<i32>) -> Result<Vec<PromptTemplate>, String> {
    prompt_template::get_recent_templates(limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_template(name: String, content: String, is_default: Option<bool>) -> Result<PromptTemplate, String> {
    prompt_template::create_template(&name, &content, is_default.unwrap_or(false))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_template(id: i64, updates: TemplateUpdate) -> Result<Option<PromptTemplate>, String> {
    prompt_template::update_template(id, updates).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_template(id: i64) -> Result<bool, String> {
    prompt_template::delete_template(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn increment_template_use(id: i64) -> Result<(), String> {
    prompt_template::increment_use_count(id).map_err(|e| e.to_string())
}
