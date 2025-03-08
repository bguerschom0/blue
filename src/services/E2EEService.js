import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

class E2EEService {
  // Generate a new key pair for the user
  static async generateKeyPair() {
    try {
      // Use Web Crypto API for key generation
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 4096,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );

      // Export public key as spki format
      const publicKeyExported = await window.crypto.subtle.exportKey(
        'spki',
        keyPair.publicKey
      );

      // Export private key as pkcs8 format
      const privateKeyExported = await window.crypto.subtle.exportKey(
        'pkcs8',
        keyPair.privateKey
      );

      // Convert ArrayBuffer to base64 string for storage
      const publicKeyString = this._arrayBufferToBase64(publicKeyExported);
      const privateKeyString = this._arrayBufferToBase64(privateKeyExported);

      return {
        publicKey: publicKeyString,
        privateKey: privateKeyString
      };
    } catch (error) {
      console.error('Error generating key pair:', error);
      throw error;
    }
  }

  // Initialize keys if not already set up
  static async initializeKeys() {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Check if user already has keys in local storage
      const privateKey = localStorage.getItem(`${user.id}_private_key`);
      
      if (privateKey) {
        return true; // Keys are already set up
      }

      // Generate new key pair for user
      const { publicKey, privateKey } = await this.generateKeyPair();

      // Store private key in local storage (encrypted with master password later)
      localStorage.setItem(`${user.id}_private_key`, privateKey);

      // Store public key in database for other users to access
      const { error } = await supabase
        .from('user_keys')
        .upsert({
          user_id: user.id,
          public_key: publicKey,
          created_at: new Date()
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error initializing keys:', error);
      return false;
    }
  }

  // Get public key for a contact
  static async getPublicKey(userId) {
    try {
      const { data, error } = await supabase
        .from('user_keys')
        .select('public_key')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data.public_key;
    } catch (error) {
      console.error('Error fetching public key:', error);
      throw error;
    }
  }

  // Encrypt message with recipient's public key
  static async encryptMessage(message, publicKeyString) {
    try {
      // Convert base64 string to ArrayBuffer
      const publicKeyBuffer = this._base64ToArrayBuffer(publicKeyString);

      // Import public key
      const publicKey = await window.crypto.subtle.importKey(
        'spki',
        publicKeyBuffer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false, // not extractable
        ['encrypt']
      );

      // Convert message to ArrayBuffer
      const encoder = new TextEncoder();
      const messageBuffer = encoder.encode(message);

      // Encrypt the message
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP'
        },
        publicKey,
        messageBuffer
      );

      // Convert encrypted data to base64 string
      return this._arrayBufferToBase64(encryptedBuffer);
    } catch (error) {
      console.error('Error encrypting message:', error);
      throw error;
    }
  }

  // Decrypt message with user's private key
  static async decryptMessage(encryptedMessage) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get private key from local storage
      const privateKeyString = localStorage.getItem(`${user.id}_private_key`);
      if (!privateKeyString) throw new Error('Private key not found');

      // Convert base64 string to ArrayBuffer
      const privateKeyBuffer = this._base64ToArrayBuffer(privateKeyString);
      const encryptedBuffer = this._base64ToArrayBuffer(encryptedMessage);

      // Import private key
      const privateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        privateKeyBuffer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false, // not extractable
        ['decrypt']
      );

      // Decrypt the message
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP'
        },
        privateKey,
        encryptedBuffer
      );

      // Convert decrypted data to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error('Error decrypting message:', error);
      return '[Decryption failed]';
    }
  }
  
  // Encrypt a file before upload
  static async encryptFile(file) {
    try {
      // Generate a random symmetric key for file encryption
      const symmetricKey = await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );
      
      // Read file as ArrayBuffer
      const fileBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
      
      // Generate a random IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt file with symmetric key
      const encryptedFileBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv
        },
        symmetricKey,
        fileBuffer
      );
      
      // Export symmetric key
      const exportedKey = await window.crypto.subtle.exportKey(
        'raw',
        symmetricKey
      );
      
      // Get current user and recipient public key
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Create a new file with encrypted content
      const encryptedFile = new File(
        [encryptedFileBuffer], 
        file.name,
        { type: 'application/octet-stream' }
      );
      
      // Store encryption metadata (key and IV) with the file
      const metadata = {
        iv: this._arrayBufferToBase64(iv),
        key: this._arrayBufferToBase64(exportedKey),
        originalType: file.type,
        encryptedBy: user.id,
        encryptedAt: new Date().toISOString()
      };
      
      // Return encrypted file and metadata
      return {
        file: encryptedFile,
        metadata: JSON.stringify(metadata)
      };
    } catch (error) {
      console.error('Error encrypting file:', error);
      throw error;
    }
  }
  
  // Decrypt a file after download
  static async decryptFile(encryptedFileUrl, metadata) {
    try {
      // Parse metadata
      const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      
      // Fetch encrypted file
      const response = await fetch(encryptedFileUrl);
      const encryptedFileBuffer = await response.arrayBuffer();
      
      // Convert base64 strings back to ArrayBuffers
      const iv = this._base64ToArrayBuffer(parsedMetadata.iv);
      const keyData = this._base64ToArrayBuffer(parsedMetadata.key);
      
      // Import symmetric key
      const symmetricKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: 'AES-GCM',
          length: 256
        },
        false, // not extractable
        ['decrypt']
      );
      
      // Decrypt file
      const decryptedFileBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv
        },
        symmetricKey,
        encryptedFileBuffer
      );
      
      // Create a new file with decrypted content and original type
      const decryptedFile = new File(
        [decryptedFileBuffer],
        parsedMetadata.originalName || 'decrypted-file',
        { type: parsedMetadata.originalType || 'application/octet-stream' }
      );
      
      return decryptedFile;
    } catch (error) {
      console.error('Error decrypting file:', error);
      throw error;
    }
  }

  // Helper function to convert ArrayBuffer to base64 string
  static _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // Helper function to convert base64 string to ArrayBuffer
  static _base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export default E2EEService;
