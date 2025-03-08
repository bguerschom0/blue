import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import E2EEService from '../services/E2EEService';
import FileUploadService from '../services/FileUploadService';
import Navigation from '../components/Navigation';
import ChatHeader from '../components/ChatHeader';
import MessageBubble from '../components/MessageBubble';
import FilePreview from '../components/FilePreview';
import { PaperAirplaneIcon, PaperClipIcon, MicrophoneIcon, LockClosedIcon } from '@heroicons/react/24/solid';
import '../styles/chat.css';

const Chat = () => {
  const { contactId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeContact, setActiveContact] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageSubscription = useRef(null);
  const presenceSubscription = useRef(null);
  
  // Fetch contacts on component mount
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('user_id', user.id);
          
        if (error) throw error;
        setContacts(data || []);
        
        // If contactId is provided, set active contact
        if (contactId) {
          const contact = data.find(c => c.id === contactId);
          if (contact) setActiveContact(contact);
        }
      } catch (error) {
        console.error('Error fetching contacts:', error);
      }
    };
    
    fetchContacts();
    
    // Cleanup subscriptions on unmount
    return () => {
      if (messageSubscription.current) messageSubscription.current.unsubscribe();
      if (presenceSubscription.current) presenceSubscription.current.unsubscribe();
    };
  }, [user.id, contactId]);
  
  // Subscribe to messages when active contact changes
  useEffect(() => {
    if (!activeContact) return;
    
    const fetchMessages = async () => {
      try {
        // Get conversation ID between current user and active contact
        const { data: conversationData, error: convError } = await supabase
          .from('conversations')
          .select('id')
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
          .or(`user1_id.eq.${activeContact.user_id},user2_id.eq.${activeContact.user_id}`)
          .single();
          
        if (convError) throw convError;
        
        const conversationId = conversationData.id;
        
        // Fetch existing messages
        const { data: messagesData, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });
          
        if (msgError) throw msgError;
        
        // Decrypt messages
        const decryptedMessages = await Promise.all(messagesData.map(async (message) => {
          if (message.sender_id === user.id) {
            // Messages sent by current user
            message.content = message.content; // Already decrypted for sender
          } else {
            // Messages sent by contact - need decryption
            message.content = await E2EEService.decryptMessage(message.content);
          }
          return message;
        }));
        
        setMessages(decryptedMessages || []);
        
        // Subscribe to new messages
        if (messageSubscription.current) messageSubscription.current.unsubscribe();
        
        messageSubscription.current = supabase
          .channel(`messages:${conversationId}`)
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          }, async (payload) => {
            const newMessage = payload.new;
            
            // Decrypt if message is from contact
            if (newMessage.sender_id !== user.id) {
              newMessage.content = await E2EEService.decryptMessage(newMessage.content);
            }
            
            setMessages(prev => [...prev, newMessage]);
          })
          .subscribe();
          
        // Subscribe to contact presence
        if (presenceSubscription.current) presenceSubscription.current.unsubscribe();
        
        presenceSubscription.current = supabase
          .channel(`presence:${activeContact.user_id}`)
          .on('presence', { event: 'sync' }, () => {
            const presence = presenceSubscription.current.presenceState();
            const contactPresence = presence[activeContact.user_id];
            
            if (contactPresence && contactPresence.length > 0) {
              setIsOnline(true);
              setLastSeen(null);
            } else {
              setIsOnline(false);
              // Fetch last seen from database
              fetchLastSeen(activeContact.user_id);
            }
          })
          .subscribe();
      } catch (error) {
        console.error('Error setting up chat:', error);
      }
    };
    
    const fetchLastSeen = async (contactUserId) => {
      const { data, error } = await supabase
        .from('user_status')
        .select('last_seen')
        .eq('user_id', contactUserId)
        .single();
        
      if (!error && data) {
        setLastSeen(new Date(data.last_seen));
      }
    };
    
    fetchMessages();
  }, [activeContact, user.id]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async () => {
    if ((!messageText || messageText.trim() === '') && attachments.length === 0) return;
    
    try {
      // Get conversation ID
      let conversationId;
      const { data: conversationData, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .or(`user1_id.eq.${activeContact.user_id},user2_id.eq.${activeContact.user_id}`)
        .single();
        
      if (convError) {
        // Create new conversation if it doesn't exist
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            user1_id: user.id,
            user2_id: activeContact.user_id,
            created_at: new Date()
          })
          .select('id')
          .single();
          
        if (createError) throw createError;
        conversationId = newConv.id;
      } else {
        conversationId = conversationData.id;
      }
      
      // Upload attachments if any
      let attachmentData = [];
      if (attachments.length > 0) {
        attachmentData = await Promise.all(attachments.map(async (file) => {
          const encryptedFile = await E2EEService.encryptFile(file);
          const { data, error } = await FileUploadService.uploadFile(encryptedFile, conversationId);
          if (error) throw error;
          return {
            id: data.id,
            name: file.name,
            size: file.size,
            type: file.type,
            url: data.url
          };
        }));
      }
      
      // Encrypt message for recipient
      const recipientPublicKey = await E2EEService.getPublicKey(activeContact.user_id);
      const encryptedContent = await E2EEService.encryptMessage(
        messageText, 
        recipientPublicKey
      );
      
      // Prepare message object
      const messageData = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: encryptedContent,
        attachments: attachmentData.length > 0 ? JSON.stringify(attachmentData) : null,
        created_at: new Date()
      };
      
      // Insert message
      const { error: msgError } = await supabase
        .from('messages')
        .insert(messageData);
        
      if (msgError) throw msgError;
      
      // Clear input and attachments
      setMessageText('');
      setAttachments([]);
      
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };
  
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => file.size <= 100 * 1024 * 1024); // 100MB limit
    
    if (validFiles.length !== files.length) {
      alert('Some files exceed the 100MB size limit and were not added.');
    }
    
    setAttachments(prev => [...prev, ...validFiles]);
    fileInputRef.current.value = null; // Reset input
  };
  
  const handleRemoveFile = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleVoiceRecord = () => {
    // Voice recording functionality
    setIsRecording(!isRecording);
  };
  
  return (
    <div className="chat-container">
      <Navigation activeTab="chat" />
      
      <div className="chat-sidebar">
        <div className="search-bar">
          <input 
            type="text" 
            placeholder="Search contacts..." 
            className="search-input"
          />
        </div>
        
        <div className="contacts-list">
          {contacts.map(contact => (
            <div 
              key={contact.id}
              className={`contact-item ${activeContact?.id === contact.id ? 'active' : ''}`}
              onClick={() => navigate(`/chat/${contact.id}`)}
            >
              <div className="contact-avatar">
                {contact.avatar_url ? (
                  <img src={contact.avatar_url} alt={contact.name} />
                ) : (
                  <div className="avatar-placeholder">
                    {contact.name.charAt(0)}
                  </div>
                )}
                {contact.online && <div className="online-indicator" />}
              </div>
              <div className="contact-info">
                <div className="contact-name">{contact.name}</div>
                <div className="contact-last-message">
                  {contact.last_message || 'Start a conversation'}
                </div>
              </div>
              <div className="contact-time">
                {contact.last_message_time && new Date(contact.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="chat-main">
        {activeContact ? (
          <>
            <ChatHeader 
              contact={activeContact}
              isOnline={isOnline}
              lastSeen={lastSeen}
              isTyping={isTyping}
            />
            
            <div className="messages-container">
              <div className="encryption-notice">
                <LockClosedIcon className="lock-icon" />
                <span>Messages are end-to-end encrypted. Nobody outside this chat can read them.</span>
              </div>
              
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id || index}
                  message={message}
                  isOwn={message.sender_id === user.id}
                  showAvatar={index === 0 || messages[index - 1]?.sender_id !== message.sender_id}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            {attachments.length > 0 && (
              <div className="attachments-preview">
                {attachments.map((file, index) => (
                  <FilePreview
                    key={index}
                    file={file}
                    onRemove={() => handleRemoveFile(index)}
                  />
                ))}
              </div>
            )}
            
            <div className="message-input-container">
              <button 
                className="attachment-button"
                onClick={() => fileInputRef.current.click()}
              >
                <PaperClipIcon className="attachment-icon" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                multiple
              />
              
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                className="message-input"
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              
              {messageText.trim() === '' ? (
                <button 
                  className={`voice-button ${isRecording ? 'recording' : ''}`}
                  onClick={handleVoiceRecord}
                >
                  <MicrophoneIcon className="voice-icon" />
                </button>
              ) : (
                <button 
                  className="send-button"
                  onClick={handleSendMessage}
                >
                  <PaperAirplaneIcon className="send-icon" />
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="empty-state">
              <img src="/images/chat-illustration.svg" alt="Select a chat" className="empty-state-image" />
              <h2>Select a contact to start chatting</h2>
              <p>Your messages will be secured with end-to-end encryption</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
