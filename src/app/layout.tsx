import type { Metadata } from 'next';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { CcmsProductProvider } from '@/contexts/CcmsProductContext';

export const metadata: Metadata = {
  title: 'CCMS - Smart Street Lighting',
  description: 'Centralized Control and Monitoring System for Smart Street Lighting',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
      </head>
      <body style={{ margin: 0 }}>
        <AppThemeProvider>
          <CcmsProductProvider>{children}</CcmsProductProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
