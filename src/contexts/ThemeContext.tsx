'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme-mode') as ThemeMode | null;
    const preference = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setMode(preference);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setMode(prev => {
      const newMode = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme-mode', newMode);
      return newMode;
    });
  };

  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: '#1f6c7e',
        light: '#4a8fa3',
        dark: '#0f3d47',
      },
      secondary: {
        main: '#10b981',
        light: '#34d399',
        dark: '#059669',
      },
      ...(mode === 'dark' && {
        background: {
          default: '#0f172a',
          paper: '#1e293b',
        },
        text: {
          primary: '#f1f5f9',
          secondary: '#cbd5e1',
        },
      }),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: {
        fontWeight: 800,
        letterSpacing: '-0.5px',
      },
      h5: {
        fontWeight: 700,
      },
      body2: {
        fontSize: '0.875rem',
      },
      caption: {
        fontSize: '0.75rem',
      },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: '12px',
            border: mode === 'dark' ? '1px solid #334155' : '1px solid #e5e7eb',
            backgroundColor: mode === 'dark' ? '#1e293b' : '#ffffff',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: '8px',
          },
        },
      },
    },
  });

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};
