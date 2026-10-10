import { Box, Typography, useTheme } from '@mui/material';
import { Building } from 'lucide-react';
import React, { useState } from 'react';

import MenuItem from '@/pages/smart-building/components/MenuItem';
import SubMenuItem from '@/pages/smart-building/components/SubMenuItem';

export interface SideBarSubMenuItem {
  id: string;
  label: string;
}

export interface SideBarMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  children?: SideBarSubMenuItem[];
}

interface SideBarProps {
  title?: string;
  state?: 'Online' | 'Offline';
  bottom_title?: string;
  data: SideBarMenuItem[];
  openPanel?: boolean;
  setOpenPanel?: (open: boolean) => void;
  onSubClick?: (id: string) => void;
  bgcolor: string;
  borderColor: string;
  iconColor: string;
  children?: React.ReactNode;
}

const Sidebar = ({
  openPanel,
  setOpenPanel,
  onSubClick,
  title,
  data,
  state,
  bottom_title,
  bgcolor,
  borderColor,
  iconColor,
  children,
}: SideBarProps) => {
  const [openMenu, setOpenMenu] = useState<string | null>('hvac');
  const [activeSub, setActiveSub] = useState<string>('floor-plan');
  const theme = useTheme();

  const handleClick = (id: string) => {
    if (setOpenPanel) {
      setOpenPanel(!openPanel);
    }
    setActiveSub(id);
    if (onSubClick) {
      onSubClick(id);
    }
  };

  return (
    <Box
      sx={{
        width: 260,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'rgba(2, 6, 23, 0.88)',
        backdropFilter: 'blur(16px)',
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
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Building size={16} color="#ffffff" />
        <Typography
          sx={{
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          borderBottom: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
        }}
      >
        {children}
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
        {data.map((menu) => (
          <Box key={menu.id} sx={{ mb: 1 }}>
            <MenuItem
              icon={menu.icon}
              label={menu.label}
              active={openMenu === menu.id}
              open={openMenu === menu.id}
              hasChildren={!!menu.children}
              onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
              bgcolor={bgcolor}
              borderColor={borderColor}
              iconColor={iconColor}
            />

            {menu.children && openMenu === menu.id && (
              <Box sx={{ mt: 1 }}>
                {menu.children.map((sub) => (
                  <SubMenuItem
                    key={sub.id}
                    label={sub.label}
                    active={activeSub === sub.id}
                    onClick={() => handleClick(sub.id)}
                    bgcolor={bgcolor}
                    iconColor={iconColor}
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
          borderTop: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
          bgcolor: 'rgba(2, 6, 23, 0.9)',
        }}
      >
        <Typography
          sx={{
            fontSize: 11,
            color: '#94a3b8',
            mb: 0.5,
          }}
        >
          {bottom_title}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: '#22c55e',
              boxShadow: '0 0 8px rgba(34,197,94,0.8)',
            }}
          />
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              color: '#22c55e',
            }}
          >
            {state}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Sidebar;
