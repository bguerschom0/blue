import React, { createContext, useState, useContext, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import E2EEService from '../services/E2EEService';
import NotificationService from '../services/NotificationService';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Create context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        
        if (session?.user) {
          setUser(session.user);
          
          // Fetch user profile
          await fetchProfile(session.user.id);
          
          // Initialize E2EE keys
          await E2EEService.initializeKeys();
          
          // Update online status
          await updateOnlineStatus(true);
          
          // Register for push notifications
          await NotificationService.registerDevice();
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
          await updateOnlineStatus(true);
        } else if (event === 'SIGNED_OUT') {
          // Update status to offline before signing out
          if (user) {
            await updateOnlineStatus(false);
          }
          setUser(null);
          setProfile(null);
        }
      }
    );
    
    // Handle page visibility change for online status
    const handleVisibilityChange = async () => {
      if (user) {
        await updateOnlineStatus(!document.hidden);
      }
    };
    
    // Set up page visibility listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Handle beforeunload event to set offline status
    const handleBeforeUnload = async () => {
      if (user) {
        await updateOnlineStatus(false);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Initialize
    initializeAuth();
    
    // Cleanup
    return () => {
      subscription?.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
  // Fetch user profile from database
  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      
      setProfile(data);
      return data;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  };
  
  // Update online status in database
  const updateOnlineStatus = async (isOnline) => {
    if (!user) return;
    
    try {
      // Get device information
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      };
      
      // Update status
      await supabase
        .from('user_status')
        .upsert({
          user_id: user.id,
          is_online: isOnline,
          last_seen: new Date().toISOString(),
          device_info: deviceInfo,
          updated_at: new Date().toISOString()
        });
        
      // Broadcast presence change for realtime updates
      if (isOnline) {
        const presenceChannel = supabase.channel(`presence:${user.id}`);
        presenceChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            presenceChannel.track({ online: true });
          }
        });
      }
    } catch (err) {
      console.error('Error updating online status:', err);
    }
  };
  
  // Sign up with email and password
  const signUp = async ({ email, password, username, displayName }) => {
    try {
      setLoading(true);
      setError(null);
      
      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (authError) throw authError;
      
      if (authData.user) {
        // Create profile record
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            username,
            display_name: displayName || username,
            email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
        if (profileError) throw profileError;
        
        // Initialize encryption keys
        await E2EEService.initializeKeys();
        
        // Create default settings
        await supabase
          .from('user_settings')
          .insert({
            user_id: authData.user.id,
            updated_at: new Date().toISOString()
          });
          
        return { success: true, user: authData.user };
      }
    } catch (err) {
      console.error('Error signing up:', err);
      setError(err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };
  
  // Sign in with email and password
  const signIn = async ({ email, password }) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      return { success: true, user: data.user };
    } catch (err) {
      console.error('Error signing in:', err);
      setError(err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };
  
  // Sign out
  const signOut = async () => {
    try {
      setLoading(true);
      
      // Update online status before signing out
      await updateOnlineStatus(false);
      
      // Unregister device from push notifications
      await NotificationService.unregisterDevice();
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      return { success: true };
    } catch (err) {
      console.error('Error signing out:', err);
      setError(err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };
  
  // Update user profile
  const updateProfile = async (updates) => {
    try {
      setLoading(true);
      
      if (!user) throw new Error('User not authenticated');
      
      // Update profile in database
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();
        
      if (error) throw error;
      
      // Update local state
      setProfile(data);
      
      return { success: true, profile: data };
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };
  
  // Reset password
  const resetPassword = async (email) => {
    try {
      setLoading(true);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      return { success: true };
    } catch (err) {
      console.error('Error resetting password:', err);
      setError(err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };
  
  // Update password
  const updatePassword = async (password) => {
    try {
      setLoading(true);
      
      const { error } = await supabase.auth.updateUser({
        password,
      });
      
      if (error) throw error;
      
      return { success: true };
    } catch (err) {
      console.error('Error updating password:', err);
      setError(err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };
  
  // Context value
  const value = {
    user,
    profile,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    updatePassword,
    supabase,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
