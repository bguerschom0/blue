import React, { createContext, useState, useContext, useEffect } from 'react';

// Create context
const ThemeContext = createContext();

// Custom hook to use the theme context
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  // Check if user has a theme preference in local storage
  // or use system preference as default
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
      return savedTheme;
    }
    
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  };
  
  const [theme, setTheme] = useState(getInitialTheme());
  
  // Apply theme to document
  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('theme', theme);
    
    // Apply theme class to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
    } else {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark-theme');
    }
  }, [theme]);
  
  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      // Only update if user hasn't manually set a preference
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    
    // Add listener with modern API if available
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Older browsers
      mediaQuery.addListener(handleChange);
    }
    
    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Older browsers
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);
  
  // Toggle theme
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };
  
  // Set theme explicitly
  const setThemeExplicitly = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark' || newTheme === 'system') {
      if (newTheme === 'system') {
        // Remove from localStorage to use system preference
        localStorage.removeItem('theme');
        // Set according to system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
      } else {
        setTheme(newTheme);
      }
    }
  };
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: setThemeExplicitly }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
