'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert as MuiAlert,
} from '@mui/material';
import { TipsAndUpdatesSharp } from '@mui/icons-material';
import { ThemeProvider } from '@mui/material/styles';
import theme from '@/lib/theme';
import { login } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      router.push('/lora/dashboard');
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d7377 0%, #14a3a8 100%)',
        }}
      >
        <Card sx={{ width: 400, p: 2 }}>
          <CardContent>
            <Box textAlign="center" mb={3}>
              <Box sx={{ mb: 2 }}>
                <img 
                  src="/logo.png" 
                  alt="CCMS Logo" 
                  style={{ height: 60, marginBottom: 8 }}
                />
              </Box>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.8, justifyContent: 'center', bgcolor: 'rgba(13,115,119,0.1)', px: 1.5, py: 0.6, borderRadius: 1.5, mb: 0.5 }}>
                <TipsAndUpdatesSharp sx={{ fontSize: 20, color: '#0d7377' }} />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#0d7377', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  IOT based
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={700} color="text.primary" sx={{ lineHeight: 1.2 }}>
                Smart Street Lighting CCMS
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Centralized control &amp; monitoring system
              </Typography>
            </Box>

            {error && <MuiAlert severity="error" sx={{ mb: 2 }}>{error}</MuiAlert>}

            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                margin="normal"
                required
                autoFocus
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
              />
              <Button
                fullWidth
                variant="contained"
                type="submit"
                disabled={loading}
                sx={{ mt: 2, py: 1.5 }}
              >
                {loading ? 'Signing in...' : 'Login'}
              </Button>
            </form>

            <Typography variant="caption" color="text.secondary" display="block" mt={2} textAlign="center">
              Default: admin / admin123
            </Typography>

            <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid #e0e0e0', textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                Powered by
              </Typography>
              <img 
                src="/Logo1.jpeg" 
                alt="Powered By" 
                style={{ height:100, opacity: 0.8 }}
              />
            </Box>
          </CardContent>
        </Card>
      </Box>
    </ThemeProvider>
  );
}
