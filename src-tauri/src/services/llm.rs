use serde::{Deserialize, Serialize};
use crate::db::model_config::{get_config_by_id, ModelConfig};
use crate::db::history::{create_history_record, HistoryInput};
use super::openai;
use super::anthropic;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognitionResult {
    pub success: bool,
    pub content: Option<String>,
    pub error: Option<String>,
    pub tokens_used: Option<i32>,
    pub duration_ms: Option<i64>,
    pub processed_image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognitionOptions {
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub max_tokens: Option<i32>,
    pub stream: Option<bool>,
    pub custom_params: Option<serde_json::Value>,
}

#[derive(Debug, Clone)]
pub struct AdapterConfig {
    pub api_url: String,
    pub api_key: String,
    pub model_name: String,
    pub max_tokens: i32,
}

impl From<&ModelConfig> for AdapterConfig {
    fn from(config: &ModelConfig) -> Self {
        Self {
            api_url: config.api_url.clone(),
            api_key: config.api_key.clone(),
            model_name: config.model_name.clone(),
            max_tokens: config.max_tokens,
        }
    }
}

pub async fn recognize(
    config_id: i64,
    image_base64: &str,
    image_mime_type: &str,
    prompt: &str,
    options: Option<RecognitionOptions>,
    callback: Option<Box<dyn Fn(String) + Send + Sync>>,
) -> RecognitionResult {
    let config = match get_config_by_id(config_id) {
        Ok(Some(c)) => c,
        Ok(None) => {
            return RecognitionResult {
                success: false,
                content: None,
                error: Some("配置不存在".to_string()),
                tokens_used: None,
                duration_ms: None,
                processed_image: None,
            };
        }
        Err(e) => {
            return RecognitionResult {
                success: false,
                content: None,
                error: Some(format!("获取配置失败: {}", e)),
                tokens_used: None,
                duration_ms: None,
                processed_image: None,
            };
        }
    };

    if !config.is_active {
        return RecognitionResult {
            success: false,
            content: None,
            error: Some("该配置已禁用".to_string()),
            tokens_used: None,
            duration_ms: None,
            processed_image: None,
        };
    }

    let adapter_config = AdapterConfig::from(&config);
    let options = options.unwrap_or(RecognitionOptions {
        temperature: None,
        top_p: None,
        max_tokens: None,
        stream: None,
        custom_params: None,
    });

    let result = match config.provider.as_str() {
        "openai" | "azure" | "oneapi" | "custom" => {
            openai::call_openai(&adapter_config, image_base64, image_mime_type, prompt, &options, callback).await
        }
        "anthropic" => {
            anthropic::call_anthropic(&adapter_config, image_base64, image_mime_type, prompt, &options, callback).await
        }
        _ => RecognitionResult {
            success: false,
            content: None,
            error: Some(format!("不支持的供应商类型: {}", config.provider)),
            tokens_used: None,
            duration_ms: None,
            processed_image: None,
        },
    };

    // Save to history if successful
    if result.success {
        let _ = create_history_record(HistoryInput {
            config_id: config.id,
            config_name: config.name.clone(),
            image_thumbnail: Some(format!("data:{};base64,{}", image_mime_type, image_base64)),
            prompt: prompt.to_string(),
            result: result.content.clone().unwrap_or_default(),
            tokens_used: result.tokens_used,
            duration_ms: result.duration_ms.map(|ms| ms as i32),
        });
    }

    result
}

pub async fn test_connection(config_id: i64) -> (bool, String) {
    let config = match get_config_by_id(config_id) {
        Ok(Some(c)) => c,
        Ok(None) => return (false, "配置不存在".to_string()),
        Err(e) => return (false, format!("获取配置失败: {}", e)),
    };

    let adapter_config = AdapterConfig::from(&config);
    
    match config.provider.as_str() {
        "openai" | "azure" | "oneapi" | "custom" => {
            openai::test_connection(&adapter_config).await
        }
        "anthropic" => {
            anthropic::test_connection(&adapter_config).await
        }
        _ => (false, format!("不支持的供应商类型: {}", config.provider)),
    }
}

pub async fn test_connection_with_config(
    provider: &str,
    api_url: &str,
    api_key: &str,
    model_name: &str,
) -> (bool, String) {
    let adapter_config = AdapterConfig {
        api_url: api_url.to_string(),
        api_key: api_key.to_string(),
        model_name: model_name.to_string(),
        max_tokens: 100,
    };

    match provider {
        "openai" | "azure" | "oneapi" | "custom" => {
            openai::test_connection(&adapter_config).await
        }
        "anthropic" => {
            anthropic::test_connection(&adapter_config).await
        }
        _ => (false, format!("不支持的供应商类型: {}", provider)),
    }
}
