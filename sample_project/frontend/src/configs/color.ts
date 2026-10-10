import { alpha } from '@mui/material/styles';

const withAlphas = (color: any) => {
  return {
    ...color,
    alpha4: alpha(color.main, 0.04),
    alpha8: alpha(color.main, 0.08),
    alpha12: alpha(color.main, 0.12),
    alpha30: alpha(color.main, 0.3),
    alpha50: alpha(color.main, 0.5),
  };
};

export const grey = {
  50: '#F8F9FA',
  100: '#F3F4F6',
  200: '#E5E7EB',
  300: '#D2D6DB',
  400: '#9DA4AE',
  500: '#6C737F',
  600: '#4D5761',
  700: '#2F3746',
  800: '#1C2536',
  900: '#111927',
};

export const success = withAlphas({
  light: '#3FC79A',
  main: '#10B981',
  dark: '#34D399',
  contrastText: '#FFFFFF',
});

export const info = withAlphas({
  light: '#03a9f4',
  main: '#0288d1',
  dark: '#01579b',
  contrastText: '#FFFFFF',
});

export const warning = withAlphas({
  light: '#FEF0C7',
  main: '#F59E0B',
  dark: '#FBBF24',
  contrastText: '#FFFFFF',
});

export const error = withAlphas({
  light: '#FEE4E2',
  main: '#EF4444',
  dark: '#F87171',
  contrastText: '#FFFFFF',
});

export const primary = withAlphas({
  light: '#c5daf2',
  main: '#22D3EE',
  dark: '#00B8DB',
  contrastText: '#FFFFFF',
});
