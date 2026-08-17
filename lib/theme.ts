export const theme = {
  colors: {
    background: '#0B0D14',
    surface: '#14151F',
    surfaceRaised: '#1B1D2A',
    accent: '#7C6FF0',
    accentDim: '#4B4574',
    textPrimary: '#F2F0EB',
    textMuted: '#7C7F94',
    error: '#E8877A',
    border: '#242637',
  },
  spacing: (n: number) => n * 4,
  radius: { sm: 8, md: 14, lg: 24, full: 999 },
  font: {
    display: { fontSize: 32, fontWeight: '600' as const, letterSpacing: -0.5 },
    body: { fontSize: 16, fontWeight: '400' as const },
    caption: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0.3 },
  },
};