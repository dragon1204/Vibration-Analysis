import { Box, Tab, Tabs } from '@mui/material';
import { motion } from 'framer-motion';
import { useState } from 'react';

import { AssetDetailTab, AssetListTab } from './tabs';

export const AssetManagementPanel = () => {
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        height: '100%',
        width: '100%',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Box
          sx={{
            px: 3,
            pt: 2,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            sx={{
              minHeight: 40,
              '& .MuiTab-root': {
                minHeight: 40,
                textTransform: 'none',
                fontSize: 14,
                fontWeight: 500,
                color: '#94a3b8',
                px: 3,
                py: 0,
                '&.Mui-selected': { color: '#00B8DB' },
              },
              '& .MuiTabs-indicator': { backgroundColor: '#00B8DB', height: 2 },
            }}
          >
            <Tab disableRipple label="Danh mục tài sản" />
            <Tab disableRipple label="Tài sản chi tiết" />
          </Tabs>
        </Box>

        {tabIndex === 0 && <AssetListTab />}
        {tabIndex === 1 && <AssetDetailTab />}
      </Box>
    </motion.div>
  );
};
