import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';

import Header from '../components/Header';

const ContentLayout = () => {
  return (
    <Box sx={{ minHeight: '100vh', overflow: 'hidden' }}>
      <Header />
      <Box
        component="main"
        sx={{
          marginTop: '60px',
          minHeight: 'calc(100vh - 60px)',
          backgroundColor: '#020617',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default ContentLayout;
