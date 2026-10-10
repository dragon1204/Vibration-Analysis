import { Box, Button, Typography } from '@mui/material';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary that catches render errors in child components.
 * Displays a styled fallback UI with error details and a retry button.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '300px',
            p: 4,
            bgcolor: 'rgba(15, 23, 42, 0.6)',
            borderRadius: 3,
            border: '1px solid rgba(239, 68, 68, 0.2)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <Typography
            variant="h5"
            sx={{ color: '#ef4444', fontWeight: 700, mb: 1 }}
          >
            ⚠️ Đã xảy ra lỗi
          </Typography>
          <Typography
            sx={{
              color: '#94a3b8',
              fontSize: 14,
              mb: 2,
              textAlign: 'center',
              maxWidth: 500,
            }}
          >
            {this.state.error?.message || 'Một lỗi không xác định đã xảy ra.'}
          </Typography>
          <Button
            variant="contained"
            onClick={this.handleRetry}
            sx={{
              bgcolor: '#00B8DB',
              color: '#fff',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              px: 4,
              '&:hover': { bgcolor: '#0097B5' },
            }}
          >
            Thử lại
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
