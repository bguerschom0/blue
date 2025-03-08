// Service Worker for SecureChat
// Handles offline functionality, push notifications, and caching
const CACHE_NAME = 'securechat-v1';
const OFFLINE_PAGE = '/offline.html';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/static/js/bundle.js',
  '/static/media/logo-dark.svg',
  '/static/media/logo-light.svg',
  '/static/media/chat-illustration.svg',
  '/images/icons/icon-72x72.png',
  '/images/icons/icon-96x96.png',
  '/images/icons/icon-128x128.png',
  '/images/icons/icon-144x144.png',
  '/images/icons/icon-152x152.png',
  '/images/icons/icon-192x192.png',
  '/images/icons/icon-384x384.png',
  '/images/icons/icon-512x512.png',
  '/manifest.json'
];

// Install event - Cache the offline page and essential assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell and content');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  
  // Force the service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker');
  
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  
  // Claim any clients immediately
  return self.clients.claim();
});

// Fetch event - Implement a cache-first strategy with network fallback
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Skip Supabase API requests (we don't want to cache API responses)
  if (event.request.url.includes('/supabase/')) {
    return;
  }
  
  // For GET requests, try the cache first, then the network
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((response) => {
        // Cache hit - return the response from the cached version
        if (response) {
          return response;
        }
        
        // Not in cache - return the result from the live server
        // This is where we make the actual network request
        return fetch(event.request)
          .then((networkResponse) => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // Clone the response
            // We need one to return to the browser and one to store in the cache
            const responseToCache = networkResponse.clone();
            
            // Open the cache and store the new response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch(() => {
            // If the network is unavailable and this is a navigation request
            // (request for a page), show the offline page
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_PAGE);
            }
            
            // For non-navigation requests that fail, return a fallback
            return new Response('Network error happened', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
    );
  }
});

// Background sync for offline messages
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background Sync', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

// Function to sync messages when online
const syncMessages = async () => {
  try {
    // Get all the messages that need to be sent from IndexedDB
    const db = await openMessagesDatabase();
    const pendingMessages = await getAllPendingMessages(db);
    
    console.log('[Service Worker] Pending messages to sync:', pendingMessages.length);
    
    // For each pending message, try to send it
    const sendPromises = pendingMessages.map(async (message) => {
      try {
        // Try to send the message to the server
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });
        
        if (response.ok) {
          // If successful, remove the message from the pending list
          await deletePendingMessage(db, message.id);
          console.log('[Service Worker] Successfully synced message:', message.id);
          return { success: true, messageId: message.id };
        } else {
          console.error('[Service Worker] Failed to sync message:', message.id, await response.text());
          return { success: false, messageId: message.id };
        }
      } catch (error) {
        console.error('[Service Worker] Error syncing message:', message.id, error);
        return { success: false, messageId: message.id };
      }
    });
    
    // Wait for all messages to be processed
    const results = await Promise.all(sendPromises);
    
    // Notify the client about the results
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'sync-complete',
        results
      });
    });
    
    return results;
  } catch (error) {
    console.error('[Service Worker] Error in syncMessages:', error);
    throw error;
  }
};

// Open (or create) the IndexedDB database for messages
const openMessagesDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SecureChatMessages', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create an object store for pending messages if it doesn't exist
      if (!db.objectStoreNames.contains('pendingMessages')) {
        const store = db.createObjectStore('pendingMessages', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

// Get all pending messages from IndexedDB
const getAllPendingMessages = (db) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingMessages'], 'readonly');
    const store = transaction.objectStore('pendingMessages');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Delete a pending message from IndexedDB
const deletePendingMessage = (db, id) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingMessages'], 'readwrite');
    const store = transaction.objectStore('pendingMessages');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Push notification event handler
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received', event);
  
  let notificationData = {};
  
  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData = {
        title: 'New Message',
        body: event.data.text(),
        icon: '/images/icons/icon-192x192.png'
      };
    }
  }
  
  const title = notificationData.title || 'SecureChat';
  const options = {
    body: notificationData.body || 'You have a new message',
    icon: notificationData.icon || '/images/icons/icon-192x192.png',
    badge: '/images/icons/badge-96x96.png',
    data: notificationData.data || {},
    vibrate: [100, 50, 100],
    actions: [
      {
        action: 'view',
        title: 'View'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event.notification.tag);
  
  // Close the notification
  event.notification.close();
  
  // Handle notification action clicks
  if (event.action === 'view' || !event.action) {
    // This looks to see if the current is already open and focuses it
    event.waitUntil(
      clients.matchAll({
        type: 'window'
      })
      .then((clientList) => {
        const url = event.notification.data.url || '/chat';
        
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type: 'notification-click',
              data: event.notification.data
            });
            return client.focus();
          }
        }
        
        // If there is no open window, open one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  }
});

// Handle message events from the client
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received from client:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
