import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Navigation from '../components/Navigation';
import { 
  MoonIcon, 
  SunIcon,
  ComputerDesktopIcon,
  BellIcon,
  BellSlashIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  ArrowPathIcon,
  DevicePhoneMobileIcon,
  PhotoIcon,
  ShieldCheckIcon,
  KeyIcon,
  TrashIcon
} from '@heroicons/react/24/solid';
import E2EEService from '../services/E2EEService';
import '../styles/settings.css';

const Settings = () => {
  const { user, profile, supabase, signOut, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  
  // Fetch user settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          throw error;
        }
        
        // If no settings found, use defaults
        setSettings(data || {
          theme: 'system',
          notifications_enabled: true,
          message_preview_enabled: true,
          read_receipts_enabled: true,
          typing_indicators_enabled: true,
          last_active_status_enabled: true,
          media_auto_download: 'wifi',
          language: 'en'
        });
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSettings();
  }, [user.id, supabase]);
  
  // Update settings in database
  const updateSettings = async (key, value) => {
    try {
      setIsSaving(true);
      
      // Update local state
      setSettings(prev => ({
        ...prev,
        [key]: value
      }));
      
      // Update in database
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          [key]: value,
          updated_at: new Date().toISOString()
        });
        
      if (error) throw error;
      
      // Special handling for theme
      if (key === 'theme') {
        setTheme(value);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      // Revert change on error
      setSettings(prev => ({
        ...prev,
        [key]: prev[key]
      }));
    } finally {
      setIsSaving(false);
    }
  };
  
  // Generate new encryption keys
  const regenerateKeys = async () => {
    if (!window.confirm('Are you sure you want to regenerate your encryption keys? This will affect your ability to decrypt previous messages.')) {
      return;
    }
    
    try {
      setIsSaving(true);
      await E2EEService.regenerateKeyPair();
      alert('Encryption keys have been regenerated');
    } catch (error) {
      console.error('Error regenerating keys:', error);
      alert('Failed to regenerate keys');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle account deletion
  const deleteAccount = async () => {
    if (deleteConfirm !== user.email) {
      alert('Email confirmation does not match');
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Delete user data
      const { error } = await supabase.rpc('delete_user_account', {
        user_id: user.id
      });
      
      if (error) throw error;
      
      // Sign out
      await signOut();
      
      // Redirect to login page (handled by AuthContext)
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account: ' + error.message);
      setIsSaving(false);
    }
  };
  
  // Language options
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
    { code: 'ru', name: 'Русский' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'ar', name: 'العربية' }
  ];
  
  // Media download options
  const mediaOptions = [
    { value: 'always', label: 'Always' },
    { value: 'wifi', label: 'Wi-Fi only' },
    { value: 'never', label: 'Never' }
  ];
  
  if (isLoading || !settings) {
    return (
      <div className="settings-loading">
        <ArrowPathIcon className="loading-icon" />
        <span>Loading settings...</span>
      </div>
    );
  }
  
  return (
    <div className="settings-container">
      <Navigation activeTab="settings" />
      
      <div className="settings-content">
        <div className="settings-header">
          <h1>Settings</h1>
        </div>
        
        <div className="settings-sections">
          {/* Appearance Section */}
          <div className="settings-section">
            <h2 className="section-title">Appearance</h2>
            
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  {settings.theme === 'dark' ? (
                    <MoonIcon className="icon" />
                  ) : settings.theme === 'light' ? (
                    <SunIcon className="icon" />
                  ) : (
                    <ComputerDesktopIcon className="icon" />
                  )}
                </div>
                <div className="setting-details">
                  <div className="setting-name">Theme</div>
                  <div className="setting-description">Choose how SecureChat appears to you</div>
                </div>
              </div>
              <div className="setting-control">
                <select
                  value={settings.theme}
                  onChange={(e) => updateSettings('theme', e.target.value)}
                  disabled={isSaving}
                  className="theme-select"
                >
                  <option value="system">System default</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
            
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  <GlobeAltIcon className="icon" />
                </div>
                <div className="setting-details">
                  <div className="setting-name">Language</div>
                  <div className="setting-description">Choose your preferred language</div>
                </div>
              </div>
              <div className="setting-control">
                <select
                  value={settings.language}
                  onChange={(e) => updateSettings('language', e.target.value)}
                  disabled={isSaving}
                  className="language-select"
                >
                  {languages.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {/* Notifications Section */}
          <div className="settings-section">
            <h2 className="section-title">Notifications</h2>
            
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  {settings.notifications_enabled ? (
                    <BellIcon className="icon" />
                  ) : (
                    <BellSlashIcon className="icon" />
                  )}
                </div>
                <div className="setting-details">
                  <div className="setting-name">Notifications</div>
                  <div className="setting-description">Receive notifications for new messages</div>
                </div>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.notifications_enabled}
                    onChange={(e) => updateSettings('notifications_enabled', e.target.checked)}
                    disabled={isSaving}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  {settings.message_preview_enabled ? (
                    <EyeIcon className="icon" />
                  ) : (
                    <EyeSlashIcon className="icon" />
                  )}
                </div>
                <div className="setting-details">
                  <div className="setting-name">Message Preview</div>
                  <div className="setting-description">Show message content in notifications</div>
                </div>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.message_preview_enabled}
                    onChange={(e) => updateSettings('message_preview_enabled', e.target.checked)}
                    disabled={isSaving || !settings.notifications_enabled}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
          
          {/* Privacy Section */}
          <div className="settings-section">
            <h2 className="section-title">Privacy</h2>
            
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  <CheckCircleIcon className="icon" />
                </div>
                <div className="setting-details">
                  <div className="setting-name">Read Receipts</div>
                  <div className="setting-description">Show when you've read messages</div>
                </div>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.read_receipts_enabled}
                    onChange={(e) => updateSettings('read_receipts_enabled', e.target.checked)}
                    disabled={isSaving}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  <DevicePhoneMobileIcon className="icon" />
                </div>
                <div className="setting-details">
                  <div className="setting-name">Last Active Status</div>
                  <div className="setting-description">Show when you were last online</div>
                </div>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.last_active_status_enabled}
                    onChange={(e) => updateSettings('last_active_status_enabled', e.target.checked)}
                    disabled={isSaving}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  <ArrowPathIcon className="icon" />
                </div>
                <div className="setting-details">
                  <div className="setting-name">Typing Indicators</div>
                  <div className="setting-description">Show when you're typing a message</div>
                </div>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.typing_indicators_enabled}
                    onChange={(e) => updateSettings('typing_indicators_enabled', e.target.checked)}
                    disabled={isSaving}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
          
          {/* Data & Storage Section */}
          <div className="settings-section">
            <h2 className="section-title">Data & Storage</h2>
            
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  <PhotoIcon className="icon" />
                </div>
                <div className="setting-details">
                  <div className="setting-name">Media Auto-Download</div>
                  <div className="setting-description">Automatically download photos and files</div>
                </div>
              </div>
              <div className="setting-control">
                <select
                  value={settings.media_auto_download}
                  onChange={(e) => updateSettings('media_auto_download', e.target.value)}
                  disabled={isSaving}
                  className="media-select"
                >
                  {mediaOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {/* Security Section */}
          <div className="settings-section">
            <h2 className="section-title">Security</h2>
            
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  <LockClosedIcon className="icon" />
                </div>
                <div className="setting-details">
                  <div className="setting-name">End-to-End Encryption</div>
                  <div className="setting-description">All messages and calls are secured with E2EE</div>
                </div>
              </div>
              <div className="setting-label">
                <span className="security-badge">Enabled</span>
              </div>
            </div>
            
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  <KeyIcon className="icon" />
                </div>
                <div className="setting-details">
                  <div className="setting-name">Encryption Keys</div>
                  <div className="setting-description">Manage your encryption keys</div>
                </div>
              </div>
              <div className="setting-control">
                <button 
                  className="regenerate-button"
                  onClick={regenerateKeys}
                  disabled={isSaving}
                >
                  {isSaving ? 'Regenerating...' : 'Regenerate Keys'}
                </button>
              </div>
            </div>
            
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  <ShieldCheckIcon className="icon" />
                </div>
                <div className="setting-details">
                  <div className="setting-name">Security Verification</div>
                  <div className="setting-description">Verify your contacts' security codes</div>
                </div>
              </div>
              <div className="setting-control">
                <button className="verify-button">Verify Contacts</button>
              </div>
            </div>
          </div>
          
          {/* Account Section */}
          <div className="settings-section">
            <h2 className="section-title">Account</h2>
            
            <div className="setting-item account-info">
              <div className="account-avatar">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.display_name} />
                ) : (
                  <div className="avatar-placeholder">
                    {profile?.display_name?.charAt(0) || user.email?.charAt(0)}
                  </div>
                )}
              </div>
              <div className="account-details">
                <div className="account-name">{profile?.display_name || 'User'}</div>
                <div className="account-email">{user.email}</div>
                <div className="account-username">@{profile?.username || 'username'}</div>
              </div>
            </div>
            
            <div className="account-actions">
              <button 
                className="edit-profile-button"
                onClick={() => navigate('/profile')}
              >
                Edit Profile
              </button>
              
              <button 
                className="sign-out-button"
                onClick={signOut}
                disabled={isSaving}
              >
                Sign Out
              </button>
            </div>
            
            <div className="danger-zone">
              <h3>Danger Zone</h3>
              <button 
                className="delete-account-button"
                onClick={() => setShowDeleteModal(true)}
                disabled={isSaving}
              >
                <TrashIcon className="trash-icon" />
                Delete Account
              </button>
            </div>
          </div>
          
          {/* About Section */}
          <div className="settings-section about-section">
            <h2 className="section-title">About</h2>
            <div className="app-info">
              <div className="app-logo">
                <img 
                  src={theme === 'dark' ? '/images/logo-light.svg' : '/images/logo-dark.svg'} 
                  alt="SecureChat Logo" 
                />
              </div>
              <div className="app-details">
                <div className="app-name">SecureChat</div>
                <div className="app-version">Version 1.0.0</div>
                <div className="copyright">© 2023 SecureChat</div>
              </div>
            </div>
            <div className="about-links">
              <a href="/terms" className="about-link">Terms of Service</a>
              <a href="/privacy" className="about-link">Privacy Policy</a>
              <a href="/licenses" className="about-link">Licenses</a>
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-container delete-modal">
            <div className="modal-header">
              <h2>Delete Account</h2>
              <button 
                className="close-button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirm('');
                }}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-content">
              <div className="warning-icon">⚠️</div>
              <p className="warning-text">
                This action <strong>cannot</strong> be undone. This will permanently delete your account and all of your messages, contacts, and data.
              </p>
              
              <div className="confirm-form">
                <p>Please type your email address to confirm:</p>
                <div className="email-display">{user.email}</div>
                <input
                  type="email"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="Enter your email"
                  className="confirm-input"
                />
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="cancel-button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirm('');
                }}
              >
                Cancel
              </button>
              <button 
                className="delete-button"
                onClick={deleteAccount}
                disabled={deleteConfirm !== user.email || isSaving}
              >
                {isSaving ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
