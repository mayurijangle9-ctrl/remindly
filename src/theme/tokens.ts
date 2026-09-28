export const lightColors = {
  bg: '#E8F1F8',
  bgElevated: '#F4F8FC',
  surface: '#F7FBFF',
  surfaceInset: '#D7E6F2',
  text: '#1C2B36',
  textMuted: '#5A7385',
  textSoft: '#7E96A8',
  primary: '#3D7EA6',
  primarySoft: '#B7D5E8',
  accent: '#5BA88A',
  danger: '#C45B5B',
  warning: '#C9923A',
  border: 'rgba(28, 43, 54, 0.08)',
  shadow: '#9BB4C7',
  highlight: '#FFFFFF',
  tabBar: '#EEF5FA',
  overlay: 'rgba(20, 35, 48, 0.45)',
};

export const darkColors = {
  bg: '#121A22',
  bgElevated: '#18232D',
  surface: '#1E2B36',
  surfaceInset: '#152028',
  text: '#E8F1F8',
  textMuted: '#A7BBC9',
  textSoft: '#7E96A8',
  primary: '#6AADD0',
  primarySoft: '#2A4558',
  accent: '#6EBF9C',
  danger: '#E07A7A',
  warning: '#E0B15C',
  border: 'rgba(232, 241, 248, 0.08)',
  shadow: '#05080C',
  highlight: '#2A3A48',
  tabBar: '#17222B',
  overlay: 'rgba(0, 0, 0, 0.62)',
};

// Fix typo in darkColors.primary
export type ThemeColors = typeof lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
};

export const elevation = {
  soft: {
    shadowColor: '#9BB4C7',
    shadowOffset: { width: 6, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  softDark: {
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  inset: {
    // visual cue handled via border/background pairing
  },
};

export const fonts = {
  display: 'Avenir Next',
  body: 'Avenir Next',
  mono: 'Menlo',
};
