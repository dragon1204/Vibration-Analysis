import { createTheme } from '@mui/material';

import { baseColors } from './baseColors';
import { palette } from './palette';
import { semanticColors } from './semanticColors';

export const theme = createTheme({
  palette: {
    ...palette,
    semantic: semanticColors,
    base: baseColors,
  },
  typography: {
    fontFamily: [
      'Roboto',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily:
            'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
        },
      },
    },
  },
});
