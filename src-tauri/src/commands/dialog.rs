use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use std::fs;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedImage {
    pub base64: String,
    pub mime_type: String,
    pub file_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFileOptions {
    pub content: String,
    pub default_name: String,
    pub filters: Vec<FileFilter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[tauri::command]
pub async fn select_image(app: tauri::AppHandle) -> Result<Option<SelectedImage>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("图片", &["jpg", "jpeg", "png", "webp", "gif"])
        .blocking_pick_file();

    match file_path {
        Some(file_path) => {
            // FilePath in Tauri 2 can be converted to PathBuf
            let path = file_path.into_path().map_err(|e| format!("无效路径: {}", e))?;
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("image")
                .to_string();

            let data = fs::read(&path).map_err(|e| format!("读取文件失败: {}", e))?;
            let base64 = BASE64.encode(&data);

            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("jpg")
                .to_lowercase();

            let mime_type = match ext.as_str() {
                "png" => "image/png",
                "gif" => "image/gif",
                "webp" => "image/webp",
                _ => "image/jpeg",
            }
            .to_string();

            Ok(Some(SelectedImage {
                base64,
                mime_type,
                file_name,
            }))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn save_file(app: tauri::AppHandle, options: SaveFileOptions) -> Result<bool, String> {
    let mut dialog = app.dialog().file();

    // Add filters
    for filter in &options.filters {
        let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
        dialog = dialog.add_filter(&filter.name, &extensions);
    }

    // Set default name
    dialog = dialog.set_file_name(&options.default_name);

    let file_path = dialog.blocking_save_file();

    match file_path {
        Some(file_path) => {
            let path = file_path.into_path().map_err(|e| format!("无效路径: {}", e))?;
            fs::write(&path, &options.content).map_err(|e| format!("保存文件失败: {}", e))?;
            Ok(true)
        }
        None => Ok(false),
    }
}
