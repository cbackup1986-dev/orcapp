use reqwest::Client;
use serde_json::json;
use std::time::Instant;
use super::llm::{AdapterConfig, RecognitionOptions, RecognitionResult};

pub async fn call_openai(
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

    let mut request_body = json!({
        "model": config.model_name,
        "messages": [{
            "role": "user",
            "content": [
                { "type": "text", "text": prompt },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": format!("data:{};base64,{}", image_mime_type, image_base64)
                    }
                }
            ]
        }],
        "max_tokens": options.max_tokens.unwrap_or(config.max_tokens)
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
    if let Some(ref custom_params) = options.custom_params {
        if let Some(obj) = custom_params.as_object() {
            for (key, value) in obj {
                request_body[key] = value.clone();
            }
        }
    }

    let response = client
        .post(&config.api_url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", config.api_key))
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

                            // Try to process lines from buffer
                            while let Some(idx) = buffer.find('\n') {
                                let line = buffer[..idx].trim().to_string();
                                buffer = buffer[idx + 1..].to_string();

                                if line.starts_with("data: ") {
                                    let data_str = &line[6..];
                                    if data_str == "[DONE]" {
                                        continue;
                                    }

                                    if let Ok(data) = serde_json::from_str::<serde_json::Value>(data_str) {
                                        if let Some(content_delta) = data["choices"][0]["delta"]["content"].as_str() {
                                            if !content_delta.is_empty() {
                                                full_content.push_str(content_delta);
                                                if let Some(cb) = &callback {
                                                    cb(content_delta.to_string());
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Process any remaining buffer content
                    if !buffer.is_empty() {
                         let line = buffer.trim();
                         if line.starts_with("data: ") {
                             let data_str = &line[6..];
                             if data_str != "[DONE]" {
                                 if let Ok(data) = serde_json::from_str::<serde_json::Value>(data_str) {
                                     if let Some(content_delta) = data["choices"][0]["delta"]["content"].as_str() {
                                          if !content_delta.is_empty() {
                                              full_content.push_str(content_delta);
                                              if let Some(cb) = &callback {
                                                  cb(content_delta.to_string());
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
                        tokens_used: None, // Streaming often doesn't return total usage at the end in the standard chunk
                        duration_ms: Some(duration_ms),
                        processed_image: None,
                    }
                } else {
                    // Non-streaming handling
                    match resp.json::<serde_json::Value>().await {
                        Ok(data) => {
                            let content = data["choices"][0]["message"]["content"]
                                .as_str()
                                .map(|s| clean_response_content(s))
                                .unwrap_or_default();
                            let tokens_used = data["usage"]["total_tokens"]
                                .as_i64()
                                .map(|t| t as i32);

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
        "messages": [{ "role": "user", "content": "Hello" }],
        "max_tokens": 5
    });

    let response = client
        .post(&config.api_url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", config.api_key))
        .json(&request_body)
        .send()
        .await;

    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<serde_json::Value>().await {
                    Ok(data) => {
                        if data["choices"].is_array() {
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
        404 => "API 地址错误或模型不存在".to_string(),
        429 => "请求频率过高或配额已用尽".to_string(),
        _ => {
            // Try to extract error message from response
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(body) {
                if let Some(msg) = data["error"]["message"].as_str() {
                    return msg.to_string();
                }
            }
            format!("服务器错误 ({}): {}", status, body)
        }
    }
}

fn clean_response_content(content: &str) -> String {
    let mut cleaned = content.trim_start().to_string();
    
    // Remove leading braces that might be JSON artifacts
    while cleaned.starts_with("}}") || cleaned.starts_with("{{") {
        cleaned = cleaned[2..].trim_start().to_string();
    }
    while cleaned.starts_with('}') || cleaned.starts_with('{') {
        cleaned = cleaned[1..].trim_start().to_string();
    }
    
    cleaned
}
