import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

class FileUploadService {
  /**
   * Upload an encrypted file to Supabase Storage
   * @param {Object} encryptedFileData - Object containing the encrypted file and metadata
   * @param {File} encryptedFileData.file - The encrypted file
   * @param {String} encryptedFileData.metadata - JSON string with encryption metadata
   * @param {String} conversationId - The conversation ID this file belongs to
   * @returns {Promise<Object>} - Upload result with file data
   */
  static async uploadFile({ file, metadata }, conversationId) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Generate a unique filename
      const fileExtension = file.name.split('.').pop();
      const uniqueFilename = `${uuidv4()}.${fileExtension}`;
      
      // Create a storage path based on conversation ID
      const storagePath = `conversations/${conversationId}/${uniqueFilename}`;
      
      // Upload the encrypted file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('secure-files')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });
        
      if (uploadError) throw uploadError;
      
      // Get the public URL for the file
      const { data: { publicUrl } } = supabase.storage
        .from('secure-files')
        .getPublicUrl(storagePath);
        
      // Create metadata record in the attachments table
      const { data: attachmentData, error: attachmentError } = await supabase
        .from('attachments')
        .insert({
          message_id: null, // Will be updated when message is created
          filename: uniqueFilename,
          original_filename: file.name,
          content_type: file.type,
          size_bytes: file.size,
          encryption_metadata: JSON.parse(metadata),
          storage_path: storagePath,
          created_at: new Date()
        })
        .select('id')
        .single();
        
      if (attachmentError) throw attachmentError;
      
      // Return the attachment data with public URL
      return {
        id: attachmentData.id,
        url: publicUrl,
        filename: file.name,
        size: file.size,
        type: file.type
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }
  
  /**
   * Download an encrypted file from Supabase Storage
   * @param {String} attachmentId - The attachment ID to download
   * @returns {Promise<Object>} - Download result with file and metadata
   */
  static async downloadFile(attachmentId) {
    try {
      // Get attachment metadata
      const { data: attachment, error: attachmentError } = await supabase
        .from('attachments')
        .select('*')
        .eq('id', attachmentId)
        .single();
        
      if (attachmentError) throw attachmentError;
      
      // Check if user has access to this file
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Verify user has access to this conversation via message
      if (attachment.message_id) {
        const { data: message, error: messageError } = await supabase
          .from('messages')
          .select('conversation_id')
          .eq('id', attachment.message_id)
          .single();
          
        if (messageError) throw messageError;
        
        const { data: membership, error: membershipError } = await supabase
          .from('conversation_members')
          .select('*')
          .eq('conversation_id', message.conversation_id)
          .eq('user_id', user.id)
          .single();
          
        if (membershipError || !membership) {
          throw new Error('Unauthorized access to file');
        }
      }
      
      // Download the file using the storage path
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('secure-files')
        .download(attachment.storage_path);
        
      if (downloadError) throw downloadError;
      
      // Create a File object from the downloaded blob
      const encryptedFile = new File(
        [fileData], 
        attachment.original_filename,
        { type: attachment.content_type }
      );
      
      // Return the encrypted file and metadata
      return {
        file: encryptedFile,
        metadata: attachment.encryption_metadata
      };
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }
  
  /**
   * Generate a thumbnail for image files
   * @param {File} file - The original file
   * @returns {Promise<Blob|null>} - Thumbnail blob or null if not an image
   */
  static async generateThumbnail(file) {
    // Only generate thumbnails for images
    if (!file.type.startsWith('image/')) {
      return null;
    }
    
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            // Create a canvas for the thumbnail
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 200;
            const MAX_HEIGHT = 200;
            
            let width = img.width;
            let height = img.height;
            
            // Calculate the new dimensions
            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            
            // Set canvas dimensions
            canvas.width = width;
            canvas.height = height;
            
            // Draw the resized image
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to blob
            canvas.toBlob((blob) => {
              resolve(blob);
            }, 'image/jpeg', 0.7);
          };
          
          img.onerror = () => {
            reject(new Error('Failed to load image for thumbnail'));
          };
          
          img.src = e.target.result;
        };
        
        reader.onerror = () => {
          reject(new Error('Failed to read file for thumbnail'));
        };
        
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  }
  
  /**
   * Delete a file from storage and database
   * @param {String} attachmentId - The attachment ID to delete
   * @returns {Promise<boolean>} - Success status
   */
  static async deleteFile(attachmentId) {
    try {
      // Get attachment metadata
      const { data: attachment, error: attachmentError } = await supabase
        .from('attachments')
        .select('*')
        .eq('id', attachmentId)
        .single();
        
      if (attachmentError) throw attachmentError;
      
      // Check if user has access to delete this file
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Verify user is the sender of the message
      if (attachment.message_id) {
        const { data: message, error: messageError } = await supabase
          .from('messages')
          .select('sender_id')
          .eq('id', attachment.message_id)
          .single();
          
        if (messageError) throw messageError;
        
        if (message.sender_id !== user.id) {
          throw new Error('Only the sender can delete attachments');
        }
      }
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('secure-files')
        .remove([attachment.storage_path]);
        
      if (storageError) throw storageError;
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('attachments')
        .delete()
        .eq('id', attachmentId);
        
      if (dbError) throw dbError;
      
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
  
  /**
   * Update an attachment's message ID when the message is created
   * @param {String} attachmentId - The attachment ID to update
   * @param {String} messageId - The message ID to associate with the attachment
   * @returns {Promise<boolean>} - Success status
   */
  static async linkAttachmentToMessage(attachmentId, messageId) {
    try {
      const { error } = await supabase
        .from('attachments')
        .update({ message_id: messageId })
        .eq('id', attachmentId);
        
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error linking attachment to message:', error);
      throw error;
    }
  }
  
  /**
   * Check if a file exceeds the maximum allowed size
   * @param {File} file - The file to check
   * @param {Number} maxSizeBytes - Maximum size in bytes (default: 100MB)
   * @returns {Boolean} - True if file is within size limit
   */
  static isFileSizeValid(file, maxSizeBytes = 100 * 1024 * 1024) {
    return file.size <= maxSizeBytes;
  }
}

export default FileUploadService;
