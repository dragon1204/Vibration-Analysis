import { Box, Typography } from '@mui/material';
import type { LucideIcon } from 'lucide-react';

import { theme } from '@/theme';

interface BuildingCardProps {
  title: string;
  count: number | string;
  status: string;
  icon: LucideIcon;
  onClick?: () => void;
  variant?: 'info' | 'success' | 'warning' | 'error';
}

const BuildingCard = ({
  title,
  count,
  status,
  icon: Icon,
  onClick,
  variant = 'info',
}: BuildingCardProps) => {
  const { semantic } = theme.palette;
  const colors = semantic[variant];

  return (
    <Box
      onClick={onClick}
      tabIndex={0}
      sx={{
        cursor: 'pointer',
        p: 3,
        borderRadius: 3,
        background:
          'linear-gradient(to bottom right, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))',
        border: `2px solid ${colors.main}`,
        backdropFilter: 'blur(4px)',
        transition: 'all 0.3s ease',
        transform: 'none',
        '&:hover': {
          transform: 'translateY(-4px)',
          borderColor: colors.light,
        },
        '&:focus': {
          outline: 'none',
          borderColor: colors.light,
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left Section */}
        <Box>
          <Typography
            sx={{
              color: colors.main,
              fontSize: '0.875rem',
              mb: 1,
            }}
          >
            {title}
          </Typography>
          <Typography
            sx={{
              fontSize: '2.25rem',
              fontWeight: 'bold',
              color: colors.text ?? '#fff',
              lineHeight: 1,
            }}
          >
            {count}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: colors.light,
              mt: 1,
            }}
          >
            {status}
          </Typography>
        </Box>

        {/* Right Section - Icon */}
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: colors.background,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Icon size={32} color={colors.main} />
        </Box>
      </Box>
    </Box>
  );
};

export default BuildingCard;
