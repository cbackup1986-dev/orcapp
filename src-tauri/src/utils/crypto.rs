use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use once_cell::sync::Lazy;
use rand::Rng;

// A fixed key for encryption (in production, this should be stored securely)
// This matches the behavior of the original TypeScript crypto module
static ENCRYPTION_KEY: Lazy<[u8; 32]> = Lazy::new(|| {
    // Use a fixed key derived from a passphrase for consistency
    // In real applications, use proper key derivation
    let passphrase = b"image-recognition-app-secret-key";
    let mut key = [0u8; 32];
    for (i, byte) in passphrase.iter().cycle().take(32).enumerate() {
        key[i] = *byte;
    }
    key
});

/// Encrypt a string value
pub fn encrypt(plaintext: &str) -> String {
    let cipher = Aes256Gcm::new_from_slice(&*ENCRYPTION_KEY).expect("Invalid key length");
    
    // Generate random nonce
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .expect("Encryption failed");
    
    // Combine nonce + ciphertext and encode as base64
    let mut combined = nonce_bytes.to_vec();
    combined.extend(ciphertext);
    
    BASE64.encode(&combined)
}

/// Decrypt an encrypted string
pub fn decrypt(encrypted: &str) -> Result<String, String> {
    let combined = BASE64.decode(encrypted).map_err(|e| e.to_string())?;
    
    if combined.len() < 12 {
        return Err("Invalid encrypted data".to_string());
    }
    
    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    
    let cipher = Aes256Gcm::new_from_slice(&*ENCRYPTION_KEY).expect("Invalid key length");
    
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed")?;
    
    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

/// Mask an API key for display (show first 4 and last 4 characters)
pub fn mask_api_key(api_key: &str) -> String {
    if api_key.len() <= 8 {
        return "*".repeat(api_key.len());
    }
    
    let first = &api_key[..4];
    let last = &api_key[api_key.len() - 4..];
    let middle = "*".repeat(api_key.len() - 8);
    
    format!("{}{}{}", first, middle, last)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let original = "test-api-key-12345";
        let encrypted = encrypt(original);
        let decrypted = decrypt(&encrypted).unwrap();
        assert_eq!(original, decrypted);
    }

    #[test]
    fn test_mask_api_key() {
        assert_eq!(mask_api_key("sk-1234567890abcdef"), "sk-1********cdef");
        assert_eq!(mask_api_key("short"), "*****");
    }
}
