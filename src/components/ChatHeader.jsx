import React, { useState } from 'react';
import { 
  PhoneIcon, 
  VideoCameraIcon, 
  EllipsisVerticalIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  TrashIcon,
  BellSlashIcon,
  UserPlusIcon,
  FlagIcon
} from '@heroicons/react/24/solid';
import '../styles/chat-header.css';

const ChatHeader = ({ contact, isOnline, lastSeen, isTyping }) => {
  const [showMenu, setShowMenu] = useState(false);
  
  const formatLastSeen = (date) => {
    if (!date) return 'Unknown';
    
    const now = new Date();
    const lastSeenDate = new Date(date);
    const diffTime = Math.abs(now - lastSeenDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    
    if (diffDays > 0) {
      return `Last seen ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else if (diffHours > 0) {
      return `Last seen ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffMinutes > 0) {
      return `Last seen ${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else {
      return 'Last seen just now';
    }
  };
  
  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };
  
  const handleStartCall = (isVideo) => {
    // Implement call functionality
    console.log(`Starting ${isVideo ? 'video' : 'audio'} call with ${contact.name}`);
    setShowMenu(false);
  };
  
  return (
    <div className="chat-header">
      <div className="contact-info">
        <div className="contact-avatar">
          {contact.avatar_url ? (
            <img src={contact.avatar_url} alt={contact.name} />
          ) : (
            <div className="avatar-placeholder">
              {contact.name.charAt(0)}
            </div>
          )}
          {isOnline && <div className="online-indicator" />}
        </div>
        
        <div className="contact-details">
          <div className="contact-name">{contact.name}</div>
          <div className="contact-status">
            {isTyping ? (
              <span className="typing-indicator">Typing...</span>
            ) : isOnline ? (
              <span className="online-status">Online</span>
            ) : lastSeen ? (
              <span className="last-seen">{formatLastSeen(lastSeen)}</span>
            ) : (
              <span className="offline-status">Offline</span>
            )}
          </div>
        </div>
      </div>
      
      <div className="header-actions">
        <button 
          className="action-button"
          onClick={() => handleStartCall(false)}
          title="Start audio call"
        >
          <PhoneIcon className="action-icon" />
        </button>
        
        <button 
          className="action-button"
          onClick={() => handleStartCall(true)}
          title="Start video call"
        >
          <VideoCameraIcon className="action-icon" />
        </button>
        
        <div className="menu-container">
          <button 
            className="action-button menu-trigger"
            onClick={toggleMenu}
            title="More options"
          >
            <EllipsisVerticalIcon className="action-icon" />
          </button>
          
          {showMenu && (
            <div className="dropdown-menu">
              <button className="menu-item">
                <InformationCircleIcon className="menu-icon" />
                <span>View Contact Info</span>
              </button>
              
              <button className="menu-item">
                <ShieldCheckIcon className="menu-icon" />
                <span>Verify Security</span>
              </button>
              
              <button className="menu-item">
                <UserPlusIcon className="menu-icon" />
                <span>Add to Group</span>
              </button>
              
              <button className="menu-item">
                <BellSlashIcon className="menu-icon" />
                <span>Mute Notifications</span>
              </button>
              
              <button className="menu-item">
                <FlagIcon className="menu-icon" />
                <span>Report Contact</span>
              </button>
              
              <button className="menu-item danger">
                <TrashIcon className="menu-icon" />
                <span>Delete Chat</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
