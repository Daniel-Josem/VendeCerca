import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const { currentUser } = useAuth();

  useEffect(() => {
    const effectiveDark = currentUser ? dark : false;
    document.documentElement.setAttribute('data-theme', effectiveDark ? 'dark' : 'light');
  }, [dark, currentUser]);

  function toggle() {
    document.documentElement.classList.add('theme-transition');
    setDark(d => !d);
    localStorage.setItem('theme', !dark ? 'dark' : 'light');
    setTimeout(() => document.documentElement.classList.remove('theme-transition'), 400);
  }

  return (
    <ThemeContext.Provider value={{ dark: currentUser ? dark : false, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
