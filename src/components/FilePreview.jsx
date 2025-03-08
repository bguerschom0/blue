import React, { useState } from 'react';
import { 
  DocumentIcon, 
  PhotoIcon, 
  FilmIcon, 
  MusicalNoteIcon, 
  XMarkIcon,
  DocumentArrowDownIcon,
  EyeIcon
} from '@heroicons/react/24/solid';
import E2EEService from '../services/E2EEService';
import FileUploadService from '../services/FileUploadService';
import '../styles/file-preview.css';

const FilePreview = ({ file, onRemove, isMessageAttachment = false }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [decryptedFile, setDecryptedFile] = useState(null);
  
  // Determine file type and icon
  const getFileIcon = () => {
    const type = file.type || '';
    
    if (type.startsWith('image/')) {
      return <PhotoIcon className="file-type-icon image" />;
    } else if (type.startsWith('video/')) {
      return <FilmIcon className="file-type-icon video" />;
    } else if (type.startsWith('audio/')) {
      return <MusicalNoteIcon className="file-type-icon audio" />;
    } else {
      return <DocumentIcon className="file-type-icon document" />;
    }
  };
  
  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Download and decrypt file
  const handleDownload = async () => {
    if (!isMessageAttachment) return;
    
    try {
      setIsDownloading(true);
      setDownloadProgress(10); // Start progress
      
      // Download encrypted file
      const { file: encryptedFile, metadata } = await FileUploadService.downloadFile(file.id);
      setDownloadProgress(50); // Update progress
      
      // Decrypt file
      const decryptedFile = await E2EEService.decryptFile(
        URL.createObjectURL(encryptedFile),
        file.encryption_metadata || metadata
      );
      setDownloadProgress(90); // Almost done
      
      // Create download link
      const downloadUrl = URL.createObjectURL(decryptedFile);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.name || 'downloaded-file';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }, 100);
      
      setDownloadProgress(100); // Complete
      
      // Reset after a moment
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Error downloading file:', error);
      setIsDownloading(false);
    }
  };
  
  // Handle preview for images
  const handlePreview = async () => {
    if (!isMessageAttachment || !file.type?.startsWith('image/')) return;
    
    try {
      if (!decryptedFile) {
        // Download and decrypt the file for preview
        const { file: encryptedFile, metadata } = await FileUploadService.downloadFile(file.id);
        
        const decrypted = await E2EEService.decryptFile(
          URL.createObjectURL(encryptedFile),
          file.encryption_metadata || metadata
        );
        
        setDecryptedFile(decrypted);
      }
      
      setShowPreview(true);
    } catch (error) {
      console.error('Error preparing preview:', error);
    }
  };
  
  // Close preview
  const closePreview = () => {
    setShowPreview(false);
  };
  
  return (
    <>
      <div className={`file-preview ${isMessageAttachment ? 'in-message' : 'in-composer'}`}>
        <div className="file-icon">
          {getFileIcon()}
        </div>
        
        <div className="file-info">
          <div className="file-name" title={file.name}>
            {file.name}
          </div>
          <div className="file-size">
            {formatFileSize(file.size)}
          </div>
        </div>
        
        {isMessageAttachment ? (
          <div className="file-actions">
            {file.type?.startsWith('image/') && (
              <button 
                className="action-button preview" 
                onClick={handlePreview}
                title="Preview image"
              >
                <EyeIcon className="action-icon" />
              </button>
            )}
            
            <button 
              className={`action-button download ${isDownloading ? 'downloading' : ''}`} 
              onClick={handleDownload}
              disabled={isDownloading}
              title="Download file"
            >
              {isDownloading ? (
                <div className="progress-indicator">
                  <div 
                    className="progress-bar"
                    style={{ width: `${downloadProgress}%` }}
                  ></div>
                </div>
              ) : (
                <DocumentArrowDownIcon className="action-icon" />
              )}
            </button>
          </div>
        ) : (
          <button 
            className="remove-button" 
            onClick={() => onRemove && onRemove()}
            title="Remove file"
          >
            <XMarkIcon className="remove-icon" />
          </button>
        )}
      </div>
      
      {/* Image Preview Modal */}
      {showPreview && decryptedFile && (
        <div className="image-preview-modal">
          <div className="modal-overlay" onClick={closePreview}></div>
          <div className="modal-content">
            <button className="close-preview" onClick={closePreview}>
              <XMarkIcon className="close-icon" />
            </button>
            <img 
              src={URL.createObjectURL(decryptedFile)} 
              alt={file.name} 
              className="preview-image"
            />
            <div className="preview-info">
              <div className="preview-filename">{file.name}</div>
              <div className="preview-filesize">{formatFileSize(file.size)}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FilePreview;
