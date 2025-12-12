use crate::db::settings;
use crate::services::image::process_image_for_api;
use crate::services::llm::{self, RecognitionOptions, RecognitionResult};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognitionRequest {
    pub config_id: i64,
    pub image_data: String,
    pub image_mime_type: String,
    pub prompt: String,
    pub options: Option<RecognitionOptions>,
}

// Global state to track active recognition
pub struct RecognitionState {
    pub abort_handle: Option<tokio::task::AbortHandle>,
}

impl RecognitionState {
    pub fn new() -> Self {
        Self {
            abort_handle: None,
        }
    }
}

pub type RecognitionStateHandle = Arc<Mutex<RecognitionState>>;

#[tauri::command]
pub async fn recognize(
    window: tauri::Window,
    state: tauri::State<'_, RecognitionStateHandle>,
    data: RecognitionRequest,
) -> Result<RecognitionResult, String> {
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

    // Spawn the recognition task
    let config_id = data.config_id;
    let image_base64 = processed.base64.clone();
    let image_mime_type = processed.mime_type.clone();
    let prompt = data.prompt.clone();
    let options = data.options.clone();
    let was_compressed = processed.was_compressed;
    let processed_base64 = processed.base64.clone();

    let task = tokio::spawn(async move {
        llm::recognize(
            config_id,
            &image_base64,
            &image_mime_type,
            &prompt,
            options,
            callback,
        )
        .await
    });

    // Store the abort handle
    {
        let mut state_guard = state.lock().await;
        state_guard.abort_handle = Some(task.abort_handle());
    }

    // Wait for the task to complete
    let result = match task.await {
        Ok(mut result) => {
            // If compression happened, return the processed image
            if was_compressed {
                result.processed_image = Some(processed_base64);
            }
            Ok(result)
        }
        Err(e) if e.is_cancelled() => {
            Ok(RecognitionResult {
                success: false,
                content: None,
                error: Some("识别已取消".to_string()),
                tokens_used: None,
                duration_ms: None,
                processed_image: None,
            })
        }
        Err(e) => Err(format!("识别任务失败: {}", e)),
    };

    // Clear the abort handle
    {
        let mut state_guard = state.lock().await;
        state_guard.abort_handle = None;
    }

    result
}

#[tauri::command]
pub async fn cancel_recognition(
    state: tauri::State<'_, RecognitionStateHandle>,
) -> Result<(), String> {
    let state_guard = state.lock().await;
    if let Some(handle) = &state_guard.abort_handle {
        handle.abort();
        println!("[Recognition] Cancellation requested - task aborted");
        Ok(())
    } else {
        Err("No active recognition to cancel".to_string())
    }
}
