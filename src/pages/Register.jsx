import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LockClosedIcon, 
  EnvelopeIcon, 
  UserIcon, 
  ExclamationCircleIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/solid';
import '../styles/auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    displayName: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    // Username validation (alphanumeric, underscore, hyphen, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(formData.username)) {
      setError('Username must be 3-20 characters and may contain letters, numbers, underscores, and hyphens');
      return false;
    }
    
    // Password validation (min 8 chars, at least 1 uppercase, 1 lowercase, 1 number)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError('Password must be at least 8 characters with at least one uppercase letter, one lowercase letter, and one number');
      return false;
    }
    
    // Confirm password
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      const { success, error, user } = await signUp({
        email: formData.email,
        password: formData.password,
        username: formData.username,
        displayName: formData.displayName || formData.username,
      });
      
      if (!success) {
        setError(error.message || 'Registration failed. Please try again.');
        return;
      }
      
      setSuccessMessage('Registration successful! Redirecting to chat...');
      
      // Redirect after a short delay to show success message
      setTimeout(() => {
        navigate('/chat');
      }, 2000);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/images/logo-dark.svg" alt="SecureChat Logo" className="auth-logo" />
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">
            Join SecureChat for private, encrypted messaging
          </p>
        </div>
        
        {error && (
          <div className="error-message">
            <ExclamationCircleIcon className="error-icon" />
            <span>{error}</span>
          </div>
        )}
        
        {successMessage && (
          <div className="success-message">
            <CheckCircleIcon className="success-icon" />
            <span>{successMessage}</span>
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
                name="email"
                type="email"
                className="form-input"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <div className="input-group">
              <UserIcon className="input-icon" />
              <input
                id="username"
                name="username"
                type="text"
                className="form-input"
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose a username"
                autoComplete="username"
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="displayName" className="form-label">
              Display Name (optional)
            </label>
            <div className="input-group">
              <UserIcon className="input-icon" />
              <input
                id="displayName"
                name="displayName"
                type="text"
                className="form-input"
                value={formData.displayName}
                onChange={handleChange}
                placeholder="Your full name (optional)"
                autoComplete="name"
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
                name="password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a password"
                autoComplete="new-password"
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
            <div className="password-requirements">
              <p>Password must have:</p>
              <ul>
                <li className={formData.password.length >= 8 ? 'valid' : ''}>
                  At least 8 characters
                </li>
                <li className={/[A-Z]/.test(formData.password) ? 'valid' : ''}>
                  At least one uppercase letter
                </li>
                <li className={/[a-z]/.test(formData.password) ? 'valid' : ''}>
                  At least one lowercase letter
                </li>
                <li className={/\d/.test(formData.password) ? 'valid' : ''}>
                  At least one number
                </li>
              </ul>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              Confirm Password
            </label>
            <div className="input-group">
              <LockClosedIcon className="input-icon" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                className="form-input"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>
        
        <div className="auth-divider">
          <span>Already have an account?</span>
        </div>
        
        <Link to="/login" className="auth-secondary-button">
          Sign in
        </Link>
        
        <p className="auth-terms">
          By creating an account, you agree to our{" "}
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

export default Register;
