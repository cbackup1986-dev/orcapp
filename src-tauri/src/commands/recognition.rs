use crate::db::settings;
use crate::services::image::process_image_for_api;
use crate::services::llm::{self, RecognitionOptions, RecognitionResult};
use serde::{Deserialize, Serialize};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognitionRequest {
    pub config_id: i64,
    pub image_data: String,
    pub image_mime_type: String,
    pub prompt: String,
    pub options: Option<RecognitionOptions>,
}

#[tauri::command]
pub async fn recognize(window: tauri::Window, data: RecognitionRequest) -> Result<RecognitionResult, String> {
    // Get settings to check compression options
    let app_settings = settings::get_all_settings().map_err(|e| e.to_string())?;
    let auto_compress = app_settings.auto_compress;
    let threshold_bytes = (app_settings.compress_threshold as usize) * 1024;

    // Process image (compress if needed)
    let processed = process_image_for_api(&data.image_data, auto_compress, threshold_bytes)
        .map_err(|e| format!("图片处理失败: {}", e))?;

    let prompt_preview: String = data.prompt.chars().take(50).collect();
    println!("[Recognition Command] Received prompt: {}", prompt_preview);

    let window_clone = window.clone();
    let callback: Option<Box<dyn Fn(String) + Send + Sync>> = Some(Box::new(move |chunk| {
        if let Err(e) = window_clone.emit("recognition-stream", chunk) {
            eprintln!("Failed to emit streaming event: {}", e);
        }
    }));

    // Call LLM service
    let mut result = llm::recognize(
        data.config_id,
        &processed.base64,
        &processed.mime_type,
        &data.prompt,
        data.options,
        callback,
    )
    .await;

    // If compression happened, return the processed image
    if processed.was_compressed {
        result.processed_image = Some(processed.base64);
    }

    Ok(result)
}
