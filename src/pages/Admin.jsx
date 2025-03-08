import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  UsersIcon, 
  ChatBubbleLeftRightIcon, 
  DocumentTextIcon,
  ShieldCheckIcon,
  BellAlertIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ChartBarIcon
} from '@heroicons/react/24/solid';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/admin.css';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const AdminDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalMessages: 0,
    totalConversations: 0,
    totalFiles: 0,
    storageUsed: 0
  });
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userPagination, setUserPagination] = useState({ page: 1, perPage: 10 });
  const [selectedUser, setSelectedUser] = useState(null);
  const [adminActions, setAdminActions] = useState({
    isDeleting: false,
    isSuspending: false,
    isResetting: false
  });

  // Check if current user is an admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        if (!user) {
          navigate('/login');
          return;
        }

        // Check if user has admin role
        const { data, error } = await supabase
          .from('admin_users')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error || !data) {
          console.error('Not authorized as admin:', error);
          navigate('/chat');
          return;
        }

        setIsAdmin(true);
        fetchDashboardData();
      } catch (error) {
        console.error('Error checking admin status:', error);
        navigate('/chat');
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, navigate]);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);

      // Get system statistics
      const [
        usersResponse,
        activeUsersResponse,
        messagesResponse,
        conversationsResponse,
        filesResponse
      ] = await Promise.all([
        supabase.from('profiles').select('count', { count: 'exact' }),
        supabase.from('user_status').select('count', { count: 'exact' }).eq('is_online', true),
        supabase.from('messages').select('count', { count: 'exact' }),
        supabase.from('conversations').select('count', { count: 'exact' }),
        supabase.from('attachments').select('count, size_bytes')
      ]);

      // Calculate storage used
      let totalStorage = 0;
      if (filesResponse.data) {
        totalStorage = filesResponse.data.reduce((sum, file) => sum + (file.size_bytes || 0), 0);
      }

      setStats({
        totalUsers: usersResponse.count || 0,
        activeUsers: activeUsersResponse.count || 0,
        totalMessages: messagesResponse.count || 0,
        totalConversations: conversationsResponse.count || 0,
        totalFiles: filesResponse.count || 0,
        storageUsed: totalStorage
      });

      // Also fetch initial user list
      fetchUsers();
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch users
  const fetchUsers = async (page = 1, query = '') => {
    try {
      setIsLoading(true);
      const { page: currentPage, perPage } = userPagination;
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      let userQuery = supabase
        .from('profiles')
        .select(`
          id,
          username,
          display_name,
          email,
          created_at,
          updated_at,
          user_status(is_online, last_seen)
        `, { count: 'exact' });

      // Apply search filter if provided
      if (query) {
        userQuery = userQuery.or(`username.ilike.%${query}%,email.ilike.%${query}%,display_name.ilike.%${query}%`);
      }

      const { data, error, count } = await userQuery
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setUsers(data || []);
      setUserPagination(prev => ({ ...prev, page, totalPages: Math.ceil((count || 0) / perPage) }));
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(1, searchQuery);
  };

  // Handle user selection
  const handleUserSelect = async (userId) => {
    try {
      setIsLoading(true);

      // Get detailed user information
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_status(*),
          user_settings(*),
          conversation_members(conversation_id)
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Get user's message count
      const { count: messageCount, error: msgError } = await supabase
        .from('messages')
        .select('count', { count: 'exact' })
        .eq('sender_id', userId);

      if (msgError) throw msgError;

      // Get user's file count and storage
      const { data: files, error: fileError } = await supabase
        .from('attachments')
        .select('id, size_bytes')
        .eq('message_id.sender_id', userId);

      if (fileError) throw fileError;

      const totalFiles = files?.length || 0;
      const storageUsed = files?.reduce((sum, file) => sum + (file.size_bytes || 0), 0) || 0;

      setSelectedUser({
        ...data,
        messageCount,
        totalFiles,
        storageUsed,
        conversationCount: data.conversation_members?.length || 0
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Admin actions

  const suspendUser = async (userId) => {
    try {
      setAdminActions(prev => ({ ...prev, isSuspending: true }));

      const { error } = await supabase
        .from('profiles')
        .update({ is_suspended: true, suspended_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;

      // Update user in the list
      setUsers(users.map(user => 
        user.id === userId ? { ...user, is_suspended: true } : user
      ));

      alert('User has been suspended');
    } catch (error) {
      console.error('Error suspending user:', error);
      alert('Failed to suspend user: ' + error.message);
    } finally {
      setAdminActions(prev => ({ ...prev, isSuspending: false }));
    }
  };

  const resetUserPassword = async (userId) => {
    try {
      setAdminActions(prev => ({ ...prev, isResetting: true }));

      // Get user email
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(userData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      alert('Password reset email has been sent');
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Failed to reset password: ' + error.message);
    } finally {
      setAdminActions(prev => ({ ...prev, isResetting: false }));
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setAdminActions(prev => ({ ...prev, isDeleting: true }));

      // Delete user data (cascade should handle related records)
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) throw error;

      // Remove user from the list
      setUsers(users.filter(user => user.id !== userId));
      setSelectedUser(null);

      alert('User has been deleted');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user: ' + error.message);
    } finally {
      setAdminActions(prev => ({ ...prev, isDeleting: false }));
    }
  };

  // Format bytes to human-readable
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (isLoading && !isAdmin) {
    return (
      <div className="admin-loading">
        <ArrowPathIcon className="loading-icon" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-sidebar">
        <div className="admin-logo">
          <img src="/images/logo-dark.svg" alt="SecureChat Logo" />
          <h2>Admin Panel</h2>
        </div>
        
        <nav className="admin-nav">
          <button 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} 
            onClick={() => setActiveTab('overview')}
          >
            <ChartBarIcon className="nav-icon" />
            <span>Overview</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} 
            onClick={() => setActiveTab('users')}
          >
            <UsersIcon className="nav-icon" />
            <span>Users</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'messages' ? 'active' : ''}`} 
            onClick={() => setActiveTab('messages')}
          >
            <ChatBubbleLeftRightIcon className="nav-icon" />
            <span>Messages</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'files' ? 'active' : ''}`} 
            onClick={() => setActiveTab('files')}
          >
            <DocumentTextIcon className="nav-icon" />
            <span>Files</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'security' ? 'active' : ''}`} 
            onClick={() => setActiveTab('security')}
          >
            <ShieldCheckIcon className="nav-icon" />
            <span>Security</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} 
            onClick={() => setActiveTab('notifications')}
          >
            <BellAlertIcon className="nav-icon" />
            <span>Notifications</span>
          </button>
        </nav>
        
        <div className="admin-profile">
          <div className="profile-info">
            <div className="profile-avatar">
              {profile?.display_name?.charAt(0) || 'A'}
            </div>
            <div className="profile-details">
              <div className="profile-name">{profile?.display_name || 'Admin'}</div>
              <div className="profile-role">Administrator</div>
            </div>
          </div>
          
          <button className="logout-button" onClick={() => navigate('/chat')}>
            Back to Chat
          </button>
        </div>
      </div>
      
      <div className="admin-content">
        {activeTab === 'overview' && (
          <div className="admin-section">
            <h2 className="section-title">Dashboard Overview</h2>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon users">
                  <UsersIcon />
                </div>
                <div className="stat-details">
                  <h3>Total Users</h3>
                  <div className="stat-value">{stats.totalUsers}</div>
                  <div className="stat-subtext">
                    <span className="highlight">{stats.activeUsers}</span> currently active
                  </div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon messages">
                  <ChatBubbleLeftRightIcon />
                </div>
                <div className="stat-details">
                  <h3>Total Messages</h3>
                  <div className="stat-value">{stats.totalMessages}</div>
                  <div className="stat-subtext">
                    Across <span className="highlight">{stats.totalConversations}</span> conversations
                  </div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon files">
                  <DocumentTextIcon />
                </div>
                <div className="stat-details">
                  <h3>Files Shared</h3>
                  <div className="stat-value">{stats.totalFiles}</div>
                  <div className="stat-subtext">
                    Using <span className="highlight">{formatBytes(stats.storageUsed)}</span> of storage
                  </div>
                </div>
              </div>
            </div>
            
            <div className="overview-charts">
              <div className="chart-container">
                <h3>User Growth</h3>
                <div className="placeholder-chart">
                  <p>User growth chart will be displayed here</p>
                </div>
              </div>
              
              <div className="chart-container">
                <h3>Daily Active Users</h3>
                <div className="placeholder-chart">
                  <p>Daily active users chart will be displayed here</p>
                </div>
              </div>
            </div>
            
            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="action-buttons">
                <button onClick={() => setActiveTab('users')}>Manage Users</button>
                <button onClick={() => setActiveTab('security')}>Security Overview</button>
                <button onClick={() => setActiveTab('files')}>Storage Management</button>
                <button onClick={fetchDashboardData}>Refresh Dashboard</button>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'users' && (
          <div className="admin-section">
            <h2 className="section-title">User Management</h2>
            
            <div className="toolbar">
              <form onSubmit={handleSearch} className="search-form">
                <div className="search-input-container">
                  <MagnifyingGlassIcon className="search-icon" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users by name, email or username"
                    className="search-input"
                  />
                </div>
                <button type="submit" className="search-button">Search</button>
              </form>
              <div className="actions">
                <button onClick={() => fetchUsers(1)} className="refresh-button">
                  <ArrowPathIcon className="refresh-icon" />
                  Refresh
                </button>
              </div>
            </div>
            
            <div className="user-management">
              <div className="users-list">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr 
                        key={user.id} 
                        className={`${selectedUser?.id === user.id ? 'selected' : ''} ${user.is_suspended ? 'suspended' : ''}`}
                      >
                        <td className="user-cell" onClick={() => handleUserSelect(user.id)}>
                          <div className="user-avatar">
                            {user.display_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                          </div>
                          <div className="user-info">
                            <div className="user-name">{user.display_name || 'Unnamed User'}</div>
                            <div className="user-username">@{user.username}</div>
                          </div>
                        </td>
                        <td>{user.email}</td>
                        <td>{new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`status-badge ${user.user_status?.is_online ? 'online' : 'offline'}`}>
                            {user.user_status?.is_online ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="action-button view-button"
                            onClick={() => handleUserSelect(user.id)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    
                    {users.length === 0 && (
                      <tr>
                        <td colSpan="5" className="no-results">
                          {searchQuery ? 'No users match your search criteria' : 'No users found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                
                <div className="pagination">
                  <button 
                    onClick={() => fetchUsers(userPagination.page - 1, searchQuery)} 
                    disabled={userPagination.page === 1}
                    className="pagination-button"
                  >
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {userPagination.page} of {userPagination.totalPages || 1}
                  </span>
                  <button 
                    onClick={() => fetchUsers(userPagination.page + 1, searchQuery)} 
                    disabled={userPagination.page === userPagination.totalPages}
                    className="pagination-button"
                  >
                    Next
                  </button>
                </div>
              </div>
              
              {selectedUser && (
                <div className="user-details-panel">
                  <div className="panel-header">
                    <h3>User Details</h3>
                    <button 
                      className="close-button"
                      onClick={() => setSelectedUser(null)}
                    >
                      Close
                    </button>
                  </div>
                  
                  <div className="user-profile">
                    <div className="profile-header">
                      <div className="large-avatar">
                        {selectedUser.display_name?.charAt(0) || selectedUser.username?.charAt(0) || 'U'}
                      </div>
                      <div className="profile-headline">
                        <h3>{selectedUser.display_name || 'Unnamed User'}</h3>
                        <p className="username">@{selectedUser.username}</p>
                        <span className={`status-badge ${selectedUser.user_status?.is_online ? 'online' : 'offline'}`}>
                          {selectedUser.user_status?.is_online ? 'Online' : 'Last seen ' + (selectedUser.user_status?.last_seen ? formatDate(selectedUser.user_status.last_seen) : 'Never')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="user-stats">
                      <div className="stat">
                        <div className="stat-value">{selectedUser.messageCount || 0}</div>
                        <div className="stat-label">Messages</div>
                      </div>
                      <div className="stat">
                        <div className="stat-value">{selectedUser.conversationCount || 0}</div>
                        <div className="stat-label">Conversations</div>
                      </div>
                      <div className="stat">
                        <div className="stat-value">{selectedUser.totalFiles || 0}</div>
                        <div className="stat-label">Files</div>
                      </div>
                      <div className="stat">
                        <div className="stat-value">{formatBytes(selectedUser.storageUsed || 0)}</div>
                        <div className="stat-label">Storage</div>
                      </div>
                    </div>
                    
                    <div className="detail-section">
                      <h4>Account Information</h4>
                      <div className="detail-row">
                        <div className="detail-label">Email:</div>
                        <div className="detail-value">{selectedUser.email}</div>
                      </div>
                      <div className="detail-row">
                        <div className="detail-label">Created:</div>
                        <div className="detail-value">{formatDate(selectedUser.created_at)}</div>
                      </div>
                      <div className="detail-row">
                        <div className="detail-label">Last Updated:</div>
                        <div className="detail-value">{formatDate(selectedUser.updated_at)}</div>
                      </div>
                      {selectedUser.is_suspended && (
                        <div className="detail-row">
                          <div className="detail-label">Suspended:</div>
                          <div className="detail-value suspended">{formatDate(selectedUser.suspended_at)}</div>
                        </div>
                      )}
                    </div>
                    
                    <div className="detail-section">
                      <h4>User Settings</h4>
                      <div className="detail-row">
                        <div className="detail-label">Theme:</div>
                        <div className="detail-value">{selectedUser.user_settings?.theme || 'System Default'}</div>
                      </div>
                      <div className="detail-row">
                        <div className="detail-label">Notifications:</div>
                        <div className="detail-value">{selectedUser.user_settings?.notifications_enabled ? 'Enabled' : 'Disabled'}</div>
                      </div>
                      <div className="detail-row">
                        <div className="detail-label">Language:</div>
                        <div className="detail-value">{selectedUser.user_settings?.language || 'English'}</div>
                      </div>
                    </div>
                    
                    <div className="admin-actions">
                      <h4>Admin Actions</h4>
                      <div className="action-buttons">
                        {selectedUser.is_suspended ? (
                          <button 
                            className="action-button unsuspend"
                            onClick={() => suspendUser(selectedUser.id, false)}
                            disabled={adminActions.isSuspending}
                          >
                            {adminActions.isSuspending ? 'Processing...' : 'Unsuspend Account'}
                          </button>
                        ) : (
                          <button 
                            className="action-button suspend"
                            onClick={() => suspendUser(selectedUser.id, true)}
                            disabled={adminActions.isSuspending}
                          >
                            {adminActions.isSuspending ? 'Processing...' : 'Suspend Account'}
                          </button>
                        )}
                        
                        <button 
                          className="action-button reset"
                          onClick={() => resetUserPassword(selectedUser.id)}
                          disabled={adminActions.isResetting}
                        >
                          {adminActions.isResetting ? 'Sending...' : 'Reset Password'}
                        </button>
                        
                        <button 
                          className="action-button delete"
                          onClick={() => deleteUser(selectedUser.id)}
                          disabled={adminActions.isDeleting}
                        >
                          {adminActions.isDeleting ? 'Deleting...' : 'Delete Account'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'messages' && (
          <div className="admin-section">
            <h2 className="section-title">Message Analytics</h2>
            
            <div className="placeholder-content">
              <p>Message analytics features will be implemented here, including:</p>
              <ul>
                <li>Message volume over time</li>
                <li>Peak usage times</li>
                <li>Average message size</li>
                <li>Conversation activity</li>
                <li>Content moderation tools</li>
                <li>Flagged content review</li>
              </ul>
            </div>
          </div>
        )}
        
        {activeTab === 'files' && (
          <div className="admin-section">
            <h2 className="section-title">File Management</h2>
            
            <div className="storage-overview">
              <div className="storage-card">
                <h3>Storage Usage</h3>
                <div className="storage-progress">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${Math.min((stats.storageUsed / (10 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="storage-details">
                  <span className="used">{formatBytes(stats.storageUsed)}</span>
                  <span className="total">of 10 GB</span>
                </div>
              </div>
              
              <div className="file-stats">
                <div className="stat-box">
                  <h3>Total Files</h3>
                  <div className="big-number">{stats.totalFiles}</div>
                </div>
                <div className="stat-box">
                  <h3>File Types</h3>
                  <div className="placeholder-chart">
                    <p>File type distribution will be displayed here</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="placeholder-content">
              <p>Additional file management features will be implemented here, including:</p>
              <ul>
                <li>File type distribution</li>
                <li>Storage cleaning recommendations</li>
                <li>Large file identification</li>
                <li>Unused file cleanup</li>
                <li>Storage quota management</li>
              </ul>
            </div>
          </div>
        )}
        
        {activeTab === 'security' && (
          <div className="admin-section">
            <h2 className="section-title">Security Overview</h2>
            
            <div className="security-stats">
              <div className="security-card">
                <h3>Encryption Status</h3>
                <div className="status-indicator active">
                  <ShieldCheckIcon className="status-icon" />
                  <span>E2EE Active</span>
                </div>
                <p>End-to-end encryption is active for all messages and files.</p>
              </div>
              
              <div className="security-card">
                <h3>Login Attempts</h3>
                <div className="placeholder-chart">
                  <p>Login attempt history will be displayed here</p>
                </div>
              </div>
              
              <div className="security-card">
                <h3>Security Alerts</h3>
                <div className="alert-list empty">
                  <p>No active security alerts</p>
                </div>
              </div>
            </div>
            
            <div className="placeholder-content">
              <p>Additional security features will be implemented here, including:</p>
              <ul>
                <li>Failed login attempt monitoring</li>
                <li>Suspicious activity detection</li>
                <li>IP access logs</li>
                <li>Security audit logs</li>
                <li>Data breach detection</li>
              </ul>
            </div>
          </div>
        )}
        
        {activeTab === 'notifications' && (
          <div className="admin-section">
            <h2 className="section-title">System Notifications</h2>
            
            <div className="notification-composer">
              <h3>Send System Notification</h3>
              <form className="composer-form">
                <div className="form-group">
                  <label htmlFor="notificationTitle">Title</label>
                  <input 
                    type="text" 
                    id="notificationTitle" 
                    placeholder="Notification title"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="notificationBody">Message</label>
                  <textarea 
                    id="notificationBody" 
                    placeholder="Notification message"
                    rows={3}
                  ></textarea>
                </div>
                
                <div className="form-group">
                  <label>Recipients</label>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input type="radio" name="recipients" value="all" defaultChecked />
                      <span>All Users</span>
                    </label>
                    <label className="checkbox-label">
                      <input type="radio" name="recipients" value="active" />
                      <span>Active Users Only</span>
                    </label>
                    <label className="checkbox-label">
                      <input type="radio" name="recipients" value="selected" />
                      <span>Selected Users</span>
                    </label>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button type="submit" className="primary-button">
                    Send Notification
                  </button>
                </div>
              </form>
            </div>
            
            <div className="notification-history">
              <h3>Recent Notifications</h3>
              <div className="history-empty">
                <p>No notifications have been sent yet</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
