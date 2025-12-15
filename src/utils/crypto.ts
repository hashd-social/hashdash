import { ethers } from 'ethers';

/**
 * Simple encryption utility for test storage
 * Converts text to encrypted hex format for vault storage
 */
export class CryptoUtils {
  /**
   * Encrypt text using AES-256-GCM
   */
  static async encryptText(text: string, password: string = 'test-key'): Promise<string> {
    // Derive key from password
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const passwordHash = await crypto.subtle.digest('SHA-256', passwordBytes);
    
    const key = await crypto.subtle.importKey(
      'raw',
      passwordHash,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt
    const textBytes = encoder.encode(text);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      textBytes
    );
    
    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    
    // Convert to hex
    return '0x' + Array.from(combined)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  /**
   * Decrypt text from hex format
   */
  static async decryptText(encryptedHex: string, password: string = 'test-key'): Promise<string> {
    // Remove 0x prefix
    const hex = encryptedHex.startsWith('0x') ? encryptedHex.slice(2) : encryptedHex;
    
    // Convert hex to bytes
    const combined = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      combined[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    
    // Extract IV and ciphertext
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    // Derive key from password
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const passwordHash = await crypto.subtle.digest('SHA-256', passwordBytes);
    
    const key = await crypto.subtle.importKey(
      'raw',
      passwordHash,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    
    return new TextDecoder().decode(decrypted);
  }
  
  /**
   * Generate CID from content (simple hash)
   */
  static generateCID(content: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(content));
  }
}
