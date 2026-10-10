import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { router } from './routes'
import NiceModal from '@ebay/nice-modal-react';
import AuthProvider from './contexts/AuthContext';
import { WeatherProvider } from './contexts/WeatherContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider 
        maxSnack={3}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        autoHideDuration={3000}
      >
        <AuthProvider>
          <WeatherProvider>
            <NiceModal.Provider>
              <RouterProvider router={router} />
            </NiceModal.Provider>
          </WeatherProvider>
        </AuthProvider>
      </SnackbarProvider>
    </QueryClientProvider>
  );
}

export default App;