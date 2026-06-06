const crypto = require('crypto');

function getCipherKey() {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY is not defined in environment variables.');
  }
  // Key must be 32 bytes (64 hex characters)
  const key = Buffer.from(encryptionKey, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters).');
  }
  return key;
}

/**
 * Encrypts an email address deterministically using AES-256-GCM.
 * The IV is derived via HMAC-SHA256 from the lowercase, trimmed email.
 * This ensures that the same email always results in the same ciphertext,
 * enabling queryability (e.g., findOne({ email: encryptEmail(email) })).
 * 
 * @param {string} email - The email to encrypt
 * @returns {string} - Ciphertext in the format iv:authTag:encryptedEmail
 */
function encryptEmail(email) {
  if (!email || typeof email !== 'string') return email;
  
  // Normalize email to ensure deterministic behavior
  const normalizedEmail = email.toLowerCase().trim();
  
  // If already encrypted, return as is
  if (normalizedEmail.includes(':') && normalizedEmail.split(':').length === 3) {
    return normalizedEmail;
  }
  
  const key = getCipherKey();
  
  // Generate a deterministic 12-byte IV using HMAC-SHA256 of the normalized email
  const iv = crypto
    .createHmac('sha256', key)
    .update(normalizedEmail)
    .digest()
    .slice(0, 12);
    
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(normalizedEmail, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an email address that was encrypted using encryptEmail.
 * 
 * @param {string} ciphertext - The ciphertext to decrypt
 * @returns {string} - Decrypted plain-text email, or the original string if not encrypted/invalid
 */
function decryptEmail(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
  
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    // Not in our encrypted format, return as is
    return ciphertext;
  }
  
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const key = getCipherKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    // If decryption fails, return the ciphertext as is to prevent crashes
    console.error('Failed to decrypt email:', err.message);
    return ciphertext;
  }
}

module.exports = {
  encryptEmail,
  decryptEmail,
};
