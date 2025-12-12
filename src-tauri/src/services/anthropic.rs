use reqwest::Client;
use serde_json::json;
use std::time::Instant;
use super::llm::{AdapterConfig, RecognitionOptions, RecognitionResult};

pub async fn call_anthropic(
    config: &AdapterConfig,
    image_base64: &str,
    image_mime_type: &str,
    prompt: &str,
    options: &RecognitionOptions,
    callback: Option<Box<dyn Fn(String) + Send + Sync>>,
) -> RecognitionResult {
    let start_time = Instant::now();
    
    if image_base64.is_empty() {
        return RecognitionResult {
            success: false,
            content: None,
            error: Some("Image data is empty".to_string()),
            tokens_used: None,
            duration_ms: None,
            processed_image: None,
        };
    }

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .unwrap();

    // Convert mime type for Anthropic format
    let media_type = match image_mime_type {
        "image/jpeg" => "image/jpeg",
        "image/png" => "image/png",
        "image/gif" => "image/gif",
        "image/webp" => "image/webp",
        _ => "image/jpeg",
    };

    let mut request_body = json!({
        "model": config.model_name,
        "max_tokens": options.max_tokens.unwrap_or(config.max_tokens),
        "messages": [{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_base64
                    }
                },
                {
                    "type": "text",
                    "text": prompt
                }
            ]
        }]
    });

    // Set stream flag
    let is_streaming = options.stream.unwrap_or(false) && callback.is_some();
    if let Some(obj) = request_body.as_object_mut() {
        obj.insert("stream".to_string(), json!(is_streaming));
    }

    if let Some(temp) = options.temperature {
        request_body["temperature"] = json!(temp);
    }
    if let Some(top_p) = options.top_p {
        request_body["top_p"] = json!(top_p);
    }

    let response = client
        .post(&config.api_url)
        .header("Content-Type", "application/json")
        .header("x-api-key", &config.api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&request_body)
        .send()
        .await;

    let duration_ms = start_time.elapsed().as_millis() as i64;

    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                if is_streaming {
                    use futures::StreamExt;
                    let mut full_content = String::new();
                    let mut stream = resp.bytes_stream();
                    let mut buffer = String::new();

                    while let Some(item) = stream.next().await {
                        if let Ok(chunk) = item {
                            let text = String::from_utf8_lossy(&chunk);
                            buffer.push_str(&text);

                            while let Some(idx) = buffer.find('\n') {
                                let line = buffer[..idx].trim().to_string();
                                buffer = buffer[idx + 1..].to_string();

                                if line.starts_with("data: ") {
                                    let data_str = &line[6..];
                                    if let Ok(data) = serde_json::from_str::<serde_json::Value>(data_str) {
                                        if data["type"] == "content_block_delta" {
                                            if let Some(delta) = data["delta"].as_object() {
                                                if delta["type"] == "text_delta" {
                                                    if let Some(text) = delta["text"].as_str() {
                                                        full_content.push_str(text);
                                                        if let Some(cb) = &callback {
                                                            cb(text.to_string());
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    // Process remaining buffer
                    if !buffer.is_empty() {
                         let line = buffer.trim();
                         if line.starts_with("data: ") {
                             let data_str = &line[6..];
                             if let Ok(data) = serde_json::from_str::<serde_json::Value>(data_str) {
                                 if data["type"] == "content_block_delta" {
                                     if let Some(delta) = data["delta"].as_object() {
                                         if delta["type"] == "text_delta" {
                                             if let Some(text) = delta["text"].as_str() {
                                                 full_content.push_str(text);
                                                 if let Some(cb) = &callback {
                                                     cb(text.to_string());
                                                 }
                                             }
                                         }
                                     }
                                 }
                             }
                         }
                    }

                    RecognitionResult {
                        success: true,
                        content: Some(full_content),
                        error: None,
                        tokens_used: None,
                        duration_ms: Some(duration_ms),
                        processed_image: None,
                    }
                } else {
                    // Non-streaming handling
                    match resp.json::<serde_json::Value>().await {
                        Ok(data) => {
                            let content = data["content"]
                                .as_array()
                                .and_then(|arr| arr.first())
                                .and_then(|block| block["text"].as_str())
                                .map(|s| s.to_string())
                                .unwrap_or_default();

                            let input_tokens = data["usage"]["input_tokens"].as_i64().unwrap_or(0);
                            let output_tokens = data["usage"]["output_tokens"].as_i64().unwrap_or(0);
                            let tokens_used = Some((input_tokens + output_tokens) as i32);

                            RecognitionResult {
                                success: true,
                                content: Some(content),
                                error: None,
                                tokens_used,
                                duration_ms: Some(duration_ms),
                                processed_image: None,
                            }
                        }
                        Err(e) => RecognitionResult {
                            success: false,
                            content: None,
                            error: Some(format!("解析响应失败: {}", e)),
                            tokens_used: None,
                            duration_ms: Some(duration_ms),
                            processed_image: None,
                        },
                    }
                }
            } else {
                let status = resp.status();
                let error_text = resp.text().await.unwrap_or_default();
                let error_message = parse_error_message(status.as_u16(), &error_text);
                
                RecognitionResult {
                    success: false,
                    content: None,
                    error: Some(error_message),
                    tokens_used: None,
                    duration_ms: Some(duration_ms),
                    processed_image: None,
                }
            }
        }
        Err(e) => {
            let error_message = if e.is_timeout() {
                "请求超时，请检查网络连接".to_string()
            } else if e.is_connect() {
                "连接失败，请检查网络连接或 API 地址".to_string()
            } else {
                format!("请求失败: {}", e)
            };

            RecognitionResult {
                success: false,
                content: None,
                error: Some(error_message),
                tokens_used: None,
                duration_ms: Some(duration_ms),
                processed_image: None,
            }
        }
    }
}

pub async fn test_connection(config: &AdapterConfig) -> (bool, String) {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap();

    let request_body = json!({
        "model": config.model_name,
        "max_tokens": 10,
        "messages": [{
            "role": "user",
            "content": "Hello"
        }]
    });

    let response = client
        .post(&config.api_url)
        .header("Content-Type", "application/json")
        .header("x-api-key", &config.api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&request_body)
        .send()
        .await;

    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<serde_json::Value>().await {
                    Ok(data) => {
                        if data["content"].is_array() {
                            (true, "连接成功".to_string())
                        } else {
                            (false, "响应格式异常".to_string())
                        }
                    }
                    Err(_) => (false, "响应解析失败".to_string()),
                }
            } else {
                let status = resp.status().as_u16();
                let error_text = resp.text().await.unwrap_or_default();
                (false, parse_error_message(status, &error_text))
            }
        }
        Err(e) => {
            if e.is_timeout() {
                (false, "连接超时".to_string())
            } else {
                (false, format!("连接失败: {}", e))
            }
        }
    }
}

fn parse_error_message(status: u16, body: &str) -> String {
    match status {
        401 => "API 密钥无效".to_string(),
        403 => "API 密钥权限不足".to_string(),
        404 => "API 地址错误或模型不存在".to_string(),
        429 => "请求频率过高或配额已用尽".to_string(),
        _ => {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(body) {
                if let Some(msg) = data["error"]["message"].as_str() {
                    return msg.to_string();
                }
            }
            format!("服务器错误 ({}): {}", status, body)
        }
    }
}
