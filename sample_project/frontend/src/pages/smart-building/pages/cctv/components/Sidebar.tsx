import { Box, Typography, useTheme } from '@mui/material';
import { Camera } from 'lucide-react';
import { useState } from 'react';

import MenuItem from '@/pages/smart-building/components/MenuItem';
import SubMenuItem from '@/pages/smart-building/components/SubMenuItem';

import { CCTVMENU } from '../utils/menu';

// interface SideBarProps {
//   openPanel?: boolean;
//   setOpenPanel?: (open: boolean) => void;
// }

const Sidebar = () => {
  const [openMenu, setOpenMenu] = useState<string | null>('live-view');
  const [activeSub, _] = useState<string>('faces');
  const theme = useTheme();

  // const handleClick = (id: string) => {
  //   if (setOpenPanel) {
  //     setOpenPanel(!openPanel);
  //     setActiveSub(id);
  //   }
  // };

  return (
    <Box
      sx={{
        width: 260,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'rgba(2, 6, 23, 0.88)',
        borderRadius: 3,
        border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
        boxShadow: `0 20px 60px ${theme.palette.base.blackAlpha[600]}`,
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 2,
          gap: 1,
          borderBottom: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Camera size={16} color="#ffffff" />
        <Typography
          sx={{
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          CCTV / VMS
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          px: 1.5,
          py: 1.25,
          overflowY: 'auto',

          /* scrollbar style */
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: theme.palette.base.slateLightAlpha[300],
            borderRadius: '3px',
            '&:hover': {
              backgroundColor: '#08647F',
            },
          },
        }}
      >
        {CCTVMENU.map((menu) => (
          <Box key={menu.id} sx={{ mb: 1 }}>
            <MenuItem
              icon={menu.icon as any}
              label={menu.label}
              active={openMenu === menu.id}
              open={openMenu === menu.id}
              hasChildren={!!menu.children}
              onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
              bgcolor={theme.palette.base.cyanAlpha[200]}
              borderColor={theme.palette.base.cyanAlpha[400]}
              iconColor="#67e8f9"
            />

            {menu.children && openMenu === menu.id && (
              <Box sx={{ mt: 1 }}>
                {menu.children.map((sub) => (
                  <SubMenuItem
                    key={sub.id}
                    label={sub.label}
                    active={activeSub === sub.id}
                    // onClick={() => handleClick(sub.id)}
                    bgcolor={theme.palette.base.cyanAlpha[200]}
                    iconColor="#67e8f9"
                  />
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          bgcolor: 'rgba(2, 6, 23, 0.9)',
        }}
      >
        {/* System Status Row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: '#22c55e',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                '@keyframes pulse': {
                  '0%, 100%': {
                    opacity: 1,
                  },
                  '50%': {
                    opacity: 0.5,
                  },
                },
              }}
            />
            <Typography
              sx={{
                fontSize: 10,
                color: '#94a3b8',
              }}
            >
              System Status
            </Typography>
          </Box>
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 700,
              color: '#22c55e',
            }}
          >
            Online
          </Typography>
        </Box>

        {/* Cameras Active Row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography
            sx={{
              fontSize: 10,
              color: '#64748b',
            }}
          >
            Cameras Active
          </Typography>
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            128/132
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Sidebar;
