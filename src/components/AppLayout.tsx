'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, IconButton, Avatar, Tooltip,
  Select, MenuItem, FormControl,
} from '@mui/material';
import {
  Dashboard as DashboardIcon, Map as MapIcon, Devices as DevicesIcon,
  Warning as WarningIcon,
  Logout as LogoutIcon, Menu as MenuIcon,
  Gamepad as GamepadIcon,
  Settings as SettingsIcon,
  Schedule as ScheduleIcon,
  TipsAndUpdatesSharp as TipsAndUpdatesSharpIcon,
  Router as RouterIcon,
  Memory as MemoryIcon,
} from '@mui/icons-material';
import { ThemeProvider } from '@mui/material/styles';
import theme from '@/lib/theme';
import { isAuthenticated, logout } from '@/lib/api';
import { useCcmsProduct, type CcmsProduct } from '@/contexts/CcmsProductContext';

const DRAWER_WIDTH = 260;

const ORBI_NAV = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { label: 'GIS Map', icon: <MapIcon />, path: '/map' },
  { label: 'Devices', icon: <DevicesIcon />, path: '/devices' },
  { label: 'Control Panel', icon: <GamepadIcon />, path: '/control' },
  { label: 'Schedule', icon: <ScheduleIcon />, path: '/schedule' },
  { label: 'Faults', icon: <WarningIcon />, path: '/faults' },
  { label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const LORA_NAV = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/lora/dashboard' },
  { label: 'GIS Map', icon: <MapIcon />, path: '/map' },
  { label: 'Gateways', icon: <RouterIcon />, path: '/lora/gateways' },
  { label: 'Nodes', icon: <MemoryIcon />, path: '/lora/nodes' },
  { label: 'LoRa Faults', icon: <WarningIcon />, path: '/lora/faults' },
  { label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const PRODUCT_HOME: Record<CcmsProduct, string> = {
  lora: '/lora/dashboard',
  orbi: '/dashboard',
};

const SIDE = {
  bg: '#0f172a',
  itemHover: '#1e293b',
  selected: '#0d7377',
  selectedBg: 'rgba(13,115,119,0.15)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  divider: '#1e293b',
};

function pathActive(pathname: string, path: string) {
  if (path === '/map') return pathname === '/map';
  if (path === '/settings') return pathname === '/settings';
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { product, setProduct } = useCcmsProduct();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState('');

  const navItems = useMemo(() => (product === 'lora' ? LORA_NAV : ORBI_NAV), [product]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    }
    setUser(localStorage.getItem('ccms_user') || '');
  }, [router]);

  useEffect(() => {
    if (pathname.startsWith('/lora') && product !== 'lora') {
      setProduct('lora');
    } else if (
      !pathname.startsWith('/lora') &&
      !['/login', '/map', '/settings'].includes(pathname) &&
      product !== 'orbi'
    ) {
      setProduct('orbi');
    }
  }, [pathname, product, setProduct]);

  const handleProductChange = (next: CcmsProduct) => {
    setProduct(next);
    router.push(PRODUCT_HOME[next]);
    setMobileOpen(false);
  };

  const navItemSx = (active: boolean) => ({
    borderRadius: 2,
    mb: 0.4,
    py: 1,
    color: active ? SIDE.textPrimary : SIDE.textSecondary,
    bgcolor: active ? SIDE.selectedBg : 'transparent',
    borderLeft: active ? `3px solid ${SIDE.selected}` : '3px solid transparent',
    '& .MuiListItemIcon-root': {
      color: active ? SIDE.selected : SIDE.textSecondary,
      minWidth: 38,
    },
    '&:hover': {
      bgcolor: active ? SIDE.selectedBg : SIDE.itemHover,
      color: SIDE.textPrimary,
      '& .MuiListItemIcon-root': { color: SIDE.selected },
    },
  });

  const pageTitle =
    navItems.find((n) => pathActive(pathname, n.path))?.label
    || (pathname.startsWith('/lora/nodes/') ? 'Node Detail' : 'CCMS');

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: SIDE.bg }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${SIDE.divider}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 0.5, bgcolor: 'rgba(13,115,119,0.12)', px: 1, py: 0.5, borderRadius: 1.2 }}>
          <TipsAndUpdatesSharpIcon sx={{ fontSize: 18, color: '#0d7377' }} />
          <Typography sx={{ color: '#0d7377', fontSize: '0.75rem', fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', lineHeight: 1 }}>
            IOT based
          </Typography>
        </Box>
        <Typography sx={{ color: SIDE.textPrimary, fontWeight: 700, fontSize: '1rem', lineHeight: 1.3, letterSpacing: 0.3, mt: 0.3 }}>
          Smart Lighting
        </Typography>
        <Typography sx={{ color: '#0d7377', fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.2, letterSpacing: 1, mb: 1.5 }}>
          CCMS
        </Typography>

        <FormControl fullWidth size="small">
          <Select
            value={product}
            onChange={(e) => handleProductChange(e.target.value as CcmsProduct)}
            sx={{
              color: SIDE.textPrimary,
              bgcolor: SIDE.itemHover,
              borderRadius: 1.5,
              fontSize: 13,
              fontWeight: 600,
              '.MuiOutlinedInput-notchedOutline': { borderColor: SIDE.divider },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: SIDE.selected },
              '.MuiSvgIcon-root': { color: SIDE.textSecondary },
            }}
          >
            <MenuItem value="lora">Orbi CCMS</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <List sx={{ flex: 1, pt: 1, px: 1, overflowY: 'auto' }}>
        {navItems.map((item) => {
          const active = pathActive(pathname, item.path);
          return (
            <ListItemButton
              key={item.path}
              selected={active}
              onClick={() => { router.push(item.path); setMobileOpen(false); }}
              sx={navItemSx(active)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ borderTop: `1px solid ${SIDE.divider}`, p: 1 }}>
        <ListItemButton
          onClick={logout}
          sx={{
            borderRadius: 2,
            color: SIDE.textSecondary,
            '&:hover': { bgcolor: SIDE.itemHover, color: '#f87171' },
            '& .MuiListItemIcon-root': { color: SIDE.textSecondary, minWidth: 38 },
          }}
        >
          <ListItemIcon><LogoutIcon /></ListItemIcon>
          <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: 14 }} />
        </ListItemButton>
      </Box>
    </Box>
  );

  const drawerPaperSx = {
    width: DRAWER_WIDTH,
    boxSizing: 'border-box' as const,
    border: 'none',
    bgcolor: SIDE.bg,
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            width: { md: DRAWER_WIDTH },
            flexShrink: 0,
            '& .MuiDrawer-paper': drawerPaperSx,
          }}
          open
        >
          {drawer}
        </Drawer>

        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': drawerPaperSx,
          }}
        >
          {drawer}
        </Drawer>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <AppBar
            position="sticky"
            elevation={0}
            sx={{
              bgcolor: '#fff',
              color: 'text.primary',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <Toolbar sx={{ gap: 1, minHeight: { xs: 68, sm: 80 } }}>
              <IconButton sx={{ display: { md: 'none' } }} onClick={() => setMobileOpen(true)}>
                <MenuIcon />
              </IconButton>

              <Typography variant="h6" sx={{ fontWeight: 600, ml: 1 }}>
                {pageTitle}
              </Typography>

              <Box sx={{ flex: 1 }} />

              <FormControl size="small" sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 140, mr: 1 }}>
                <Select
                  value={product}
                  onChange={(e) => handleProductChange(e.target.value as CcmsProduct)}
                  sx={{ fontSize: 13, fontWeight: 600, borderRadius: 2 }}
                >
                  <MenuItem value="lora">Orbi CCMS</MenuItem>
                </Select>
              </FormControl>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="CCMS Logo" style={{ height: 68, width: 'auto', objectFit: 'contain', borderRadius: 6 }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Logo1.jpeg" alt="Client Logo" style={{ height: 88, width: 'auto', objectFit: 'contain', borderRadius: 6 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 1 }}>
                <Box sx={{ width: 1, bgcolor: '#e2e8f0', height: 36 }} />
                <Avatar sx={{ bgcolor: '#0d7377', width: 36, height: 36, fontSize: 15, fontWeight: 700 }}>
                  {user?.charAt(0).toUpperCase() || 'A'}
                </Avatar>
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <Typography variant="body2" fontWeight={600} lineHeight={1.2}>{user || 'Admin'}</Typography>
                  <Typography variant="caption" color="text.secondary" lineHeight={1}>Administrator</Typography>
                </Box>
              </Box>
            </Toolbar>
          </AppBar>

          <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, overflow: 'auto' }}>
            {children}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
