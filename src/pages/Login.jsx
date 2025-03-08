import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LockClosedIcon, EnvelopeIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';
import '../styles/auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      const { success, error } = await signIn({ email, password });
      
      if (!success) {
        setError(error.message || 'Failed to sign in');
        return;
      }
      
      // Redirect to chat page on success
      navigate('/chat');
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/images/logo-dark.svg" alt="SecureChat Logo" className="auth-logo" />
          <h1 className="auth-title">Sign in to SecureChat</h1>
          <p className="auth-subtitle">
            End-to-end encrypted messaging for everyone
          </p>
        </div>
        
        {error && (
          <div className="error-message">
            <ExclamationCircleIcon className="error-icon" />
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <div className="input-group">
              <EnvelopeIcon className="input-icon" />
              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="input-group">
              <LockClosedIcon className="input-icon" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          
          <div className="form-footer">
            <Link to="/forgot-password" className="auth-link">
              Forgot password?
            </Link>
          </div>
          
          <button 
            type="submit" 
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        
        <div className="auth-divider">
          <span>New to SecureChat?</span>
        </div>
        
        <Link to="/register" className="auth-secondary-button">
          Create an account
        </Link>
        
        <p className="auth-terms">
          By signing in, you agree to our{" "}
          <a href="/terms" className="auth-link">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="auth-link">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
};

export default Login;
