use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use tauri_plugin_clipboard_manager::ClipboardExt;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardImage {
    pub base64: String,
    pub mime_type: String,
}

#[tauri::command]
pub async fn read_clipboard_image(app: tauri::AppHandle) -> Result<Option<ClipboardImage>, String> {
    // Try to read image from clipboard
    match app.clipboard().read_image() {
        Ok(img) => {
            // Get raw bytes from the image
            let bytes = img.rgba().to_vec();
            if bytes.is_empty() {
                return Ok(None);
            }
            
            // Encode as base64
            let base64 = BASE64.encode(&bytes);
            
            Ok(Some(ClipboardImage {
                base64,
                mime_type: "image/png".to_string(),
            }))
        }
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn write_clipboard_text(app: tauri::AppHandle, text: String) -> Result<(), String> {
    app.clipboard()
        .write_text(text)
        .map_err(|e| format!("写入剪贴板失败: {}", e))
}
