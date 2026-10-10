import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import OutputOutlinedIcon from '@mui/icons-material/OutputOutlined';
import { Box, Tab, Tabs } from '@mui/material';
import { motion } from 'framer-motion';
import { useState } from 'react';

import { ExportReceiptTab, ImportReceiptTab } from './tabs';

export const WarehousePanel = () => {
  const [tabIndex, setTabIndex] = useState(0);

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
        {/* Tab bar */}
        <Box
          sx={{
            px: 3,
            pt: 2,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Tabs
            value={tabIndex}
            onChange={(_, v) => setTabIndex(v)}
            sx={{
              minHeight: 42,
              '& .MuiTab-root': {
                minHeight: 42,
                textTransform: 'none',
                fontSize: 14,
                fontWeight: 500,
                color: '#64748b',
                px: 3,
                py: 0,
                gap: 1,
                '&.Mui-selected': { color: '#00B8DB' },
              },
              '& .MuiTabs-indicator': { backgroundColor: '#00B8DB', height: 2 },
            }}
          >
            <Tab
              disableRipple
              icon={<InventoryOutlinedIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
              label="Phiếu nhập kho"
            />
            <Tab
              disableRipple
              icon={<OutputOutlinedIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
              label="Phiếu xuất kho"
            />
          </Tabs>
        </Box>

        {/* Tab content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {tabIndex === 0 && <ImportReceiptTab />}
          {tabIndex === 1 && <ExportReceiptTab />}
        </Box>
      </Box>
    </motion.div>
  );
};
