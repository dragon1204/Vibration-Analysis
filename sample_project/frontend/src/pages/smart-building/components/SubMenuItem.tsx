import { KeyboardArrowRight } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';

interface SubMenuItemProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  bgcolor?: string;
  iconColor?: string;
}

const SubMenuItem = ({
  label,
  active,
  onClick,
  bgcolor,
  iconColor,
}: SubMenuItemProps) => {
  return (
    <Box
      onClick={onClick}
      sx={{
        height: 34,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        ml: 2,
        my: 0.5,
        px: 2.25,
        py: 1,
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        borderLeftColor: active ? iconColor : 'transparent',
        borderRadius: 2,
        cursor: 'pointer',
        bgcolor: active ? bgcolor : 'rgba(255,255,255,0.04)',
        ...(!active && {
          '&:hover': { transform: 'translateX(3px)' },
        }),
      }}
    >
      <Typography
        sx={{
          fontSize: 12,
          color: active ? '#fff' : '#94a3b8',
          fontWeight: active ? 600 : 400,
        }}
      >
        {label}
      </Typography>
      <KeyboardArrowRight
        sx={{ fontSize: 14, color: active ? iconColor : '#94a3b8' }}
      />
    </Box>
  );
};

export default SubMenuItem;
