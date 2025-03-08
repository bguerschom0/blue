import React, { useState } from 'react';
import { 
  CheckCircleIcon, 
  ExclamationCircleIcon, 
  LockClosedIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';
import FilePreview from './FilePreview';
import E2EEService from '../services/E2EEService';
import '../styles/message-bubble.css';

const MessageBubble = ({ message, isOwn, showAvatar }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };
  
  const toggleMenu = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
    
    if (showDeleteConfirm) {
      setShowDeleteConfirm(false);
    }
  };
  
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };
  
  const handleDeleteCancel = (e) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };
  
  const handleDeleteConfirm = async (e) => {
    e.stopPropagation();
    
    try {
      // Implement message deletion logic here
      console.log('Deleting message:', message.id);
      setShowMenu(false);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };
  
  const handleReplyClick = (e) => {
    e.stopPropagation();
    
    // Implement reply logic here
    console.log('Replying to message:', message.id);
    setShowMenu(false);
  };
  
  // Parse message attachments if any
  const attachments = message.attachments ? JSON.parse(message.attachments) : [];
  
  return (
    <div className={`message-container ${isOwn ? 'own' : 'other'}`}>
      {showAvatar && !isOwn && (
        <div className="message-avatar">
          <div className="avatar-placeholder">
            {/* Add profile picture or placeholder */}
            {'?'}
          </div>
        </div>
      )}
      
      <div className="message-content">
        <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
          {message.reply_to && (
            <div className="reply-preview">
              <div className="reply-content">
                {/* Display reply content here */}
                Replied message
              </div>
            </div>
          )}
          
          {/* Text content */}
          {message.content && (
            <div className="message-text">{message.content}</div>
          )}
          
          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="message-attachments">
              {attachments.map((attachment, index) => (
                <FilePreview
                  key={index}
                  file={attachment}
                  isMessageAttachment={true}
                />
              ))}
            </div>
          )}
          
          {/* Message status and time */}
          <div className="message-footer">
            {message.is_edited && (
              <span className="edited-indicator">Edited</span>
            )}
            
            <span className="message-time">{formatTime(message.created_at)}</span>
            
            {isOwn && (
              <div className="message-status">
                {message.read_by && message.read_by.length > 0 ? (
                  <CheckCircleIcon className="status-icon read" title="Read" />
                ) : (
                  <CheckCircleIcon className="status-icon delivered" title="Delivered" />
                )}
              </div>
            )}
            
            <button className="message-menu-button" onClick={toggleMenu}>
              <EllipsisVerticalIcon className="menu-icon" />
            </button>
          </div>
          
          {/* Encryption indicator */}
          <div className="encryption-indicator">
            <LockClosedIcon className="lock-icon" />
          </div>
          
          {/* Action menu */}
          {showMenu && (
            <div className={`message-menu ${isOwn ? 'own' : 'other'}`}>
              <button className="menu-item" onClick={handleReplyClick}>
                <ArrowUturnLeftIcon className="menu-icon" />
                <span>Reply</span>
              </button>
              
              {isOwn && (
                <button className="menu-item delete" onClick={handleDeleteClick}>
                  <TrashIcon className="menu-icon" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          )}
          
          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <div className="delete-confirm">
              <p>Delete this message?</p>
              <div className="confirm-actions">
                <button 
                  className="confirm-button cancel" 
                  onClick={handleDeleteCancel}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button delete" 
                  onClick={handleDeleteConfirm}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Date separator - This would typically be handled at a parent level */}
        {false && (
          <div className="date-separator">
            <span>{formatDate(message.created_at)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
