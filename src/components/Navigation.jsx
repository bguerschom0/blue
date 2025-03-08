import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  UserIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  MoonIcon,
  SunIcon
} from '@heroicons/react/24/solid';
import { useTheme } from '../contexts/ThemeContext';
import '../styles/navigation.css';

const Navigation = ({ activeTab }) => {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    // Check if user is an admin
    const checkAdminStatus = async () => {
      if (!user) return;
      
      try {
        const { data } = await supabase
          .from('admin_users')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        setIsAdmin(!!data);
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    
    checkAdminStatus();
  }, [user]);
  
  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };
  
  return (
    <div className="navigation">
      <div className="logo-container">
        <img 
          src={theme === 'dark' ? '/images/logo-light.svg' : '/images/logo-dark.svg'} 
          alt="SecureChat Logo" 
          className="nav-logo"
        />
        <span className="logo-text">SecureChat</span>
      </div>
      
      <nav className="nav-items">
        <Link 
          to="/chat" 
          className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
          title="Chat"
        >
          <ChatBubbleLeftRightIcon className="nav-icon" />
          <span className="nav-label">Chat</span>
        </Link>
        
        <Link 
          to="/contacts" 
          className={`nav-item ${activeTab === 'contacts' ? 'active' : ''}`}
          title="Contacts"
        >
          <UserGroupIcon className="nav-icon" />
          <span className="nav-label">Contacts</span>
        </Link>
        
        <Link 
          to="/profile" 
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          title="Profile"
        >
          <UserIcon className="nav-icon" />
          <span className="nav-label">Profile</span>
        </Link>
        
        <Link 
          to="/settings" 
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          title="Settings"
        >
          <Cog6ToothIcon className="nav-icon" />
          <span className="nav-label">Settings</span>
        </Link>
        
        {isAdmin && (
          <Link 
            to="/admin" 
            className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
            title="Admin"
          >
            <ShieldCheckIcon className="nav-icon" />
            <span className="nav-label">Admin</span>
          </Link>
        )}
      </nav>
      
      <div className="nav-footer">
        <button 
          className="theme-toggle" 
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <SunIcon className="theme-icon" />
          ) : (
            <MoonIcon className="theme-icon" />
          )}
        </button>
        
        <div className="user-profile">
          <div className="avatar">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name} />
            ) : (
              <div className="avatar-placeholder">
                {profile?.display_name?.charAt(0) || user?.email?.charAt(0) || '?'}
              </div>
            )}
            <div className={`status-indicator ${profile?.is_online ? 'online' : 'offline'}`}></div>
          </div>
          
          <div className="user-info">
            <div className="user-name">{profile?.display_name || 'User'}</div>
            <div className="user-status">
              <span className="status-dot"></span>
              <span className="status-text">
                {profile?.is_online ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        
        <button 
          className="sign-out-button" 
          onClick={handleSignOut}
          title="Sign Out"
        >
          <ArrowRightOnRectangleIcon className="sign-out-icon" />
          <span className="sign-out-text">Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Navigation;
