use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::{DynamicImage, ImageFormat, ImageReader};
use std::io::Cursor;

#[allow(dead_code)]
pub const SUPPORTED_FORMATS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif"];

#[derive(Debug)]
pub struct ProcessedImage {
    pub base64: String,
    pub mime_type: String,
    #[allow(dead_code)]
    pub original_size: usize,
    #[allow(dead_code)]
    pub compressed_size: Option<usize>,
    pub was_compressed: bool,
}

/// Process image for API call
/// Compresses if needed and limits dimensions
pub fn process_image_for_api(
    input_base64: &str,
    auto_compress: bool,
    max_size_bytes: usize,
) -> Result<ProcessedImage, String> {
    // Decode base64
    let image_data = BASE64.decode(input_base64).map_err(|e| format!("Invalid base64: {}", e))?;
    let original_size = image_data.len();

    if !auto_compress {
        return Ok(ProcessedImage {
            base64: input_base64.to_string(),
            mime_type: "image/jpeg".to_string(),
            original_size,
            compressed_size: None,
            was_compressed: false,
        });
    }

    // Load image
    let img = ImageReader::new(Cursor::new(&image_data))
        .with_guessed_format()
        .map_err(|e| format!("Failed to read image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    let (width, height) = (img.width(), img.height());
    let max_dimension: u32 = 1920;

    let needs_resize = width > max_dimension || height > max_dimension;
    let needs_compress = original_size > max_size_bytes;

    if !needs_resize && !needs_compress {
        return Ok(ProcessedImage {
            base64: input_base64.to_string(),
            mime_type: detect_mime_type(&image_data),
            original_size,
            compressed_size: None,
            was_compressed: false,
        });
    }

    // Resize if needed
    let img = if needs_resize {
        img.resize(max_dimension, max_dimension, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    // Try PNG first (lossless)
    let compressed = compress_image(&img, max_size_bytes)?;

    Ok(ProcessedImage {
        base64: BASE64.encode(&compressed.0),
        mime_type: compressed.1,
        original_size,
        compressed_size: Some(compressed.0.len()),
        was_compressed: true,
    })
}

fn compress_image(img: &DynamicImage, max_size_bytes: usize) -> Result<(Vec<u8>, String), String> {
    // Try PNG first
    let mut png_buffer = Vec::new();
    let mut cursor = Cursor::new(&mut png_buffer);
    img.write_to(&mut cursor, ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    if png_buffer.len() <= max_size_bytes {
        return Ok((png_buffer, "image/png".to_string()));
    }

    // Fall back to JPEG with progressive quality reduction
    let mut quality = 90u8;
    loop {
        let mut jpeg_buffer = Vec::new();
        let mut cursor = Cursor::new(&mut jpeg_buffer);
        
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, quality);
        img.to_rgb8().write_with_encoder(encoder)
            .map_err(|e| format!("Failed to encode JPEG: {}", e))?;

        if jpeg_buffer.len() <= max_size_bytes || quality <= 60 {
            return Ok((jpeg_buffer, "image/jpeg".to_string()));
        }

        quality -= 5;
    }
}

fn detect_mime_type(data: &[u8]) -> String {
    // Check magic bytes
    if data.len() >= 8 {
        if data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
            return "image/png".to_string();
        }
        if data.starts_with(&[0xFF, 0xD8, 0xFF]) {
            return "image/jpeg".to_string();
        }
        if data.starts_with(b"GIF87a") || data.starts_with(b"GIF89a") {
            return "image/gif".to_string();
        }
        if data.starts_with(b"RIFF") && data.len() >= 12 && &data[8..12] == b"WEBP" {
            return "image/webp".to_string();
        }
    }
    "image/jpeg".to_string()
}

/// Generate a thumbnail
#[allow(dead_code)]
pub fn generate_thumbnail(input_base64: &str, width: u32, height: u32) -> Result<String, String> {
    let image_data = BASE64.decode(input_base64).map_err(|e| format!("Invalid base64: {}", e))?;
    
    let img = ImageReader::new(Cursor::new(&image_data))
        .with_guessed_format()
        .map_err(|e| format!("Failed to read image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    let thumbnail = img.thumbnail(width, height);
    
    let mut buffer = Vec::new();
    let mut cursor = Cursor::new(&mut buffer);
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, 70);
    thumbnail.to_rgb8().write_with_encoder(encoder)
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    Ok(format!("data:image/jpeg;base64,{}", BASE64.encode(&buffer)))
}

#[allow(dead_code)]
pub fn is_valid_format(filename: &str) -> bool {
    if let Some(ext) = filename.rsplit('.').next() {
        SUPPORTED_FORMATS.contains(&ext.to_lowercase().as_str())
    } else {
        false
    }
}
