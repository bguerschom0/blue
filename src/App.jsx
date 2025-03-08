import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Contacts from './pages/Contacts';
import Profile from './pages/Profile';
import E2EEService from './services/E2EEService';
import NotificationService from './services/NotificationService';
import './styles/global.css';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// PrivateRoute component to protect authenticated routes
const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};

// Main App Component
const App = () => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize app-wide services
    const initializeApp = async () => {
      // Initialize E2EE keys on first login
      await E2EEService.initializeKeys();
      
      // Register for push notifications
      await NotificationService.registerDevice();
      
      setIsInitialized(true);
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    return <div className="loading-screen">Initializing secure connection...</div>;
  }

  return (
    <Router>
      <AuthProvider>
        <div className="app-container">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route 
              path="/chat/:contactId?" 
              element={
                <PrivateRoute>
                  <Chat />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/contacts" 
              element={
                <PrivateRoute>
                  <Contacts />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <PrivateRoute>
                  <Settings />
                </PrivateRoute>
              } 
            />
            <Route path="/" element={<Navigate to="/chat" />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
};

export default App;
