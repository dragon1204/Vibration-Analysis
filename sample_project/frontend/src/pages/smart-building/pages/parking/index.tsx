import { Box } from '@mui/material';

// import { useState } from 'react';

// import ParkingBackground from '@/assets/images/parking-background.png';

const Parking = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        paddingX: 3,
        paddingY: 4,
        gap: 3,
        flex: 1,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          width: 260,
          flexShrink: 0,
        }}
      ></Box>
      <Box sx={{ flex: 1, overflow: 'hidden' }}>{/* Content goes here */}</Box>
    </Box>
  );
};

export default Parking;
