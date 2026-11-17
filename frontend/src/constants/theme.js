export const theme = {
  colors: {
    primaryGreen: '#166534',
    secondaryGreen: '#22C55E',
    darkGreen: '#14532D',
    lightGreen: '#DCFCE7',
    background: '#F8FAF7',
    cardBackground: '#FFFFFF',
    primaryText: '#172B1D',
    secondaryText: '#64748B',
    warning: '#F59E0B',
    danger: '#DC2626',
    success: '#16A34A',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #166534 0%, #14532D 100%)',
    secondary: 'linear-gradient(135deg, #22C55E 0%, #166534 100%)',
    light: 'linear-gradient(135deg, #DCFCE7 0%, #F8FAF7 100%)',
    hero: 'linear-gradient(135deg, #14532D 0%, #166534 50%, #22C55E 100%)',
  },
  shadows: {
    soft: '0 4px 20px rgba(22, 101, 52, 0.08)',
    card: '0 8px 30px rgba(22, 101, 52, 0.10)',
    hover: '0 12px 40px rgba(22, 101, 52, 0.15)',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },
  transitions: {
    fast: '0.2s ease',
    normal: '0.3s ease',
    slow: '0.5s ease',
  },
  font: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    telugu: "'Noto Sans Telugu', sans-serif",
    devanagari: "'Noto Sans Devanagari', sans-serif",
  },
  containerMax: '1200px',
  headerHeight: '70px',
};

export const breakpoints = {
  mobile: '480px',
  tablet: '1024px',
  desktop: '1280px',
};

export default theme;