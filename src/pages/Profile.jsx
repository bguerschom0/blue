import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import QRCodeGenerator from '../components/QRCodeGenerator';
import { 
  UserIcon, 
  EnvelopeIcon, 
  IdentificationIcon,
  PencilIcon,
  PhotoIcon,
  QrCodeIcon,
  ArrowLeftIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';
import '../styles/profile.css';

const Profile = () => {
  const { user, profile, updateProfile, supabase } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    bio: '',
    error: ''
  });
  const fileInputRef = useRef(null);
  
  // Load profile data
  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        error: ''
      });
    }
  }, [profile]);
  
  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      error: ''
    }));
  };
  
  // Handle avatar click
  const handleAvatarClick = () => {
    if (isEditing) {
      fileInputRef.current.click();
    }
  };
  
  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setFormData(prev => ({
        ...prev,
        error: 'Image too large. Maximum size is 5MB.'
      }));
      return;
    }
    
    // Check if file is an image
    if (!file.type.match('image.*')) {
      setFormData(prev => ({
        ...prev,
        error: 'Please select an image file.'
      }));
      return;
    }
    
    setAvatar(file);
    
    // Preview image
    const reader = new FileReader();
    reader.onloadend = () => {
      document.getElementById('avatar-preview').src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  
  // Toggle edit mode
  const toggleEdit = () => {
    if (isEditing && formData.display_name !== profile?.display_name || 
        formData.username !== profile?.username || 
        formData.bio !== profile?.bio ||
        avatar) {
      // Confirm discarding changes
      if (!window.confirm('Discard unsaved changes?')) {
        return;
      }
      
      // Reset form
      setFormData({
        display_name: profile?.display_name || '',
        username: profile?.username || '',
        bio: profile?.bio || '',
        error: ''
      });
      setAvatar(null);
    }
    
    setIsEditing(!isEditing);
  };
  
  // Save profile changes
  const saveProfile = async () => {
    try {
      setIsSaving(true);
      
      // Validate form
      if (!formData.display_name.trim() || !formData.username.trim()) {
        setFormData(prev => ({
          ...prev,
          error: 'Name and username are required.'
        }));
        setIsSaving(false);
        return;
      }
      
      // Username validation (alphanumeric, underscore, hyphen, 3-20 chars)
      const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
      if (!usernameRegex.test(formData.username)) {
        setFormData(prev => ({
          ...prev,
          error: 'Username must be 3-20 characters and may contain letters, numbers, underscores, and hyphens.'
        }));
        setIsSaving(false);
        return;
      }
      
      // Check if username is taken (only if username changed)
      if (formData.username !== profile?.username) {
        const { data: existingUser, error: usernameError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', formData.username)
          .neq('id', user.id)
          .single();
          
        if (existingUser) {
          setFormData(prev => ({
            ...prev,
            error: 'Username is already taken.'
          }));
          setIsSaving(false);
          return;
        }
      }
      
      // Upload avatar if changed
      let avatar_url = profile?.avatar_url;
      if (avatar) {
        const file_path = `avatars/${user.id}/${Date.now()}.${avatar.name.split('.').pop()}`;
        
        const { error: uploadError } = await supabase.storage
          .from('user-content')
          .upload(file_path, avatar, {
            cacheControl: '3600',
            upsert: true
          });
          
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('user-content')
          .getPublicUrl(file_path);
          
        avatar_url = publicUrl;
      }
      
      // Update profile
      const updates = {
        display_name: formData.display_name,
        username: formData.username,
        bio: formData.bio,
        avatar_url,
        updated_at: new Date().toISOString()
      };
      
      const { error } = await updateProfile(updates);
      
      if (error) throw error;
      
      // Exit edit mode
      setIsEditing(false);
      setAvatar(null);
    } catch (error) {
      console.error('Error updating profile:', error);
      setFormData(prev => ({
        ...prev,
        error: error.message || 'Failed to update profile.'
      }));
    } finally {
      setIsSaving(false);
    }
  };
  
  // Toggle QR code view
  const toggleQR = () => {
    setShowQR(!showQR);
  };
  
  // Generate QR code data
  const getQRData = () => {
    if (!profile) return '';
    
    const data = {
      username: profile.username,
      displayName: profile.display_name,
      id: user.id
    };
    
    return JSON.stringify(data);
  };
  
  return (
    <div className="profile-container">
      <Navigation activeTab="profile" />
      
      <div className="profile-content">
        {showQR ? (
          <div className="qr-view">
            <div className="qr-header">
              <button className="back-button" onClick={toggleQR}>
                <ArrowLeftIcon className="back-icon" />
                Back to Profile
              </button>
              <h1>My QR Code</h1>
            </div>
            
            <div className="qr-code-container">
              <QRCodeGenerator data={getQRData()} size={250} />
            </div>
            
            <div className="qr-instructions">
              <p>Scan this code with another SecureChat user to add you as a contact</p>
              <div className="user-info">
                <div className="user-name">{profile?.display_name}</div>
                <div className="user-username">@{profile?.username}</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="profile-header">
              <h1>{isEditing ? 'Edit Profile' : 'Profile'}</h1>
              
              {!isEditing && (
                <button 
                  className="qr-button"
                  onClick={toggleQR}
                  title="Show QR Code"
                >
                  <QrCodeIcon className="qr-icon" />
                </button>
              )}
              
              <button 
                className={`edit-button ${isEditing ? 'cancel' : ''}`}
                onClick={toggleEdit}
                disabled={isSaving}
                title={isEditing ? 'Cancel editing' : 'Edit profile'}
              >
                {isEditing ? (
                  <XMarkIcon className="edit-icon" />
                ) : (
                  <PencilIcon className="edit-icon" />
                )}
              </button>
              
              {isEditing && (
                <button 
                  className="save-button"
                  onClick={saveProfile}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? (
                    <span className="saving-indicator"></span>
                  ) : (
                    <CheckIcon className="save-icon" />
                  )}
                </button>
              )}
            </div>
            
            {formData.error && (
              <div className="error-message">{formData.error}</div>
            )}
            
            <div className="profile-avatar-section">
              <div 
                className={`profile-avatar ${isEditing ? 'editable' : ''}`}
                onClick={handleAvatarClick}
              >
                {profile?.avatar_url || avatar ? (
                  <img 
                    id="avatar-preview"
                    src={profile?.avatar_url} 
                    alt={profile?.display_name} 
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {profile?.display_name?.charAt(0) || user.email?.charAt(0)}
                  </div>
                )}
                
                {isEditing && (
                  <div className="avatar-overlay">
                    <PhotoIcon className="camera-icon" />
                  </div>
                )}
              </div>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
            
            <div className="profile-form">
              <div className="form-group">
                <label className="form-label">
                  <UserIcon className="form-icon" />
                  Display Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="display_name"
                    value={formData.display_name}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Your full name"
                  />
                ) : (
                  <div className="form-value">{profile?.display_name}</div>
                )}
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  <IdentificationIcon className="form-icon" />
                  Username
                </label>
                {isEditing ? (
                  <div className="username-input-wrapper">
                    <span className="username-prefix">@</span>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      className="form-input username-input"
                      placeholder="username"
                    />
                  </div>
                ) : (
                  <div className="form-value username-value">
                    @{profile?.username}
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  <EnvelopeIcon className="form-icon" />
                  Email
                </label>
                <div className="form-value email-value">
                  {user.email}
                  <span className="verified-badge">Verified</span>
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  <UserIcon className="form-icon" />
                  Bio
                </label>
                {isEditing ? (
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    className="form-textarea"
                    placeholder="Write something about yourself"
                    maxLength={160}
                  ></textarea>
                ) : (
                  <div className="form-value bio-value">
                    {profile?.bio || 'No bio yet'}
                  </div>
                )}
              </div>
              
              {isEditing && (
                <div className="form-helper">
                  <p>
                    Your display name and bio are visible to your contacts. 
                    Username is used to find and add you as a contact.
                  </p>
                </div>
              )}
            </div>
            
            {!isEditing && (
              <div className="account-actions">
                <button 
                  className="action-button password-button"
                  onClick={() => navigate('/settings')}
                >
                  More Settings
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
