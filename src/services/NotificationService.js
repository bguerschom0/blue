import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

class NotificationService {
  /**
   * Register the current device for push notifications
   * @returns {Promise<Object>} Registration result
   */
  static async registerDevice() {
    try {
      // Check if push notifications are supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return { success: false, reason: 'not_supported' };
      }
      
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('User not authenticated');
        return { success: false, reason: 'not_authenticated' };
      }
      
      // Check if permission is already granted
      let permission = Notification.permission;
      
      // Request permission if needed
      if (permission !== 'granted') {
        permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Notification permission denied');
          return { success: false, reason: 'permission_denied' };
        }
      }
      
      // Register service worker if not already registered
      const registration = await this._getServiceWorkerRegistration();
      
      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this._urlBase64ToUint8Array(
          process.env.REACT_APP_VAPID_PUBLIC_KEY
        ),
      });
      
      // Generate a unique device ID or retrieve existing one
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = uuidv4();
        localStorage.setItem('device_id', deviceId);
      }
      
      // Get device information
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      };
      
      // Save subscription to database
      const { data, error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: user.id,
          token: JSON.stringify(subscription),
          device_id: deviceId,
          device_info: deviceInfo,
          created_at: new Date(),
          last_used_at: new Date(),
        })
        .select()
        .single();
        
      if (error) throw error;
      
      console.log('Push notification registration successful');
      return { success: true, data };
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return { success: false, reason: 'registration_error', error };
    }
  }
  
  /**
   * Unregister the current device from push notifications
   * @returns {Promise<Object>} Unregistration result
   */
  static async unregisterDevice() {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, reason: 'not_authenticated' };
      }
      
      // Get device ID from local storage
      const deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        return { success: false, reason: 'device_not_registered' };
      }
      
      // Remove subscription from database
      const { error } = await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('device_id', deviceId);
        
      if (error) throw error;
      
      // Unsubscribe from push manager
      try {
        const registration = await this._getServiceWorkerRegistration();
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      } catch (e) {
        console.error('Error unsubscribing from push manager:', e);
      }
      
      // Remove device ID from local storage
      localStorage.removeItem('device_id');
      
      return { success: true };
    } catch (error) {
      console.error('Error unregistering device:', error);
      return { success: false, reason: 'unregistration_error', error };
    }
  }
  
  /**
   * Show a local notification
   * @param {Object} options Notification options
   * @param {String} options.title Notification title
   * @param {String} options.body Notification body
   * @param {String} options.icon Notification icon URL
   * @param {String} options.url URL to open when notification is clicked
   * @returns {Promise<Boolean>} Success status
   */
  static async showLocalNotification({ title, body, icon, url }) {
    try {
      // Check if notifications are supported and permission is granted
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        return false;
      }
      
      // Get service worker registration
      const registration = await this._getServiceWorkerRegistration();
      
      // Show notification
      await registration.showNotification(title, {
        body,
        icon: icon || '/images/logo-dark.svg',
        vibrate: [100, 50, 100],
        data: {
          url: url || window.location.origin,
          dateOfArrival: Date.now(),
        },
      });
      
      return true;
    } catch (error) {
      console.error('Error showing notification:', error);
      return false;
    }
  }
  
  /**
   * Update user notification settings
   * @param {Object} settings Notification settings
   * @param {Boolean} settings.enabled Enable/disable notifications
   * @param {Boolean} settings.messagePreview Show message preview in notifications
   * @returns {Promise<Object>} Update result
   */
  static async updateSettings({ enabled, messagePreview }) {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, reason: 'not_authenticated' };
      }
      
      // Update user settings
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          notifications_enabled: enabled,
          message_preview_enabled: messagePreview,
          updated_at: new Date(),
        })
        .select()
        .single();
        
      if (error) throw error;
      
      return { success: true, data };
    } catch (error) {
      console.error('Error updating notification settings:', error);
      return { success: false, reason: 'update_error', error };
    }
  }
  
  /**
   * Get user notification settings
   * @returns {Promise<Object>} User settings
   */
  static async getSettings() {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, reason: 'not_authenticated' };
      }
      
      // Get user settings
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      
      // If no settings found, return defaults
      if (!data) {
        return {
          success: true,
          data: {
            notifications_enabled: true,
            message_preview_enabled: true,
          },
        };
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return { success: false, reason: 'fetch_error', error };
    }
  }
  
  /**
   * Helper method to get service worker registration
   * @returns {Promise<ServiceWorkerRegistration>}
   * @private
   */
  static async _getServiceWorkerRegistration() {
    // Register service worker if needed
    if (!navigator.serviceWorker.controller) {
      await navigator.serviceWorker.register('/serviceWorker.js');
    }
    
    return navigator.serviceWorker.ready;
  }
  
  /**
   * Convert URL-safe base64 string to Uint8Array for VAPID key
   * @param {String} base64String URL-safe base64 string
   * @returns {Uint8Array} Converted array
   * @private
   */
  static _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
      
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }
}

export default NotificationService;
