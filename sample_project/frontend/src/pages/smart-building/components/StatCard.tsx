import { Box, Typography, useTheme } from '@mui/material';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  height: number;
  textColor?: string;
  fontSizeText?: number;
  fontSizeUnit?: number;
  fontSizeValue?: number;
  bgcolor?: string;
}

const StatCard = ({
  title,
  value,
  unit,
  height,
  textColor,
  fontSizeText,
  fontSizeUnit,
  fontSizeValue,
  bgcolor,
}: StatCardProps) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        width: '100%',
        height: height,
        borderRadius: 3,
        p: 1.2,
        background: bgcolor ? bgcolor : '#1B2537',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        transition: '0.3s',
        gap: 1,
        '&:hover': {
          background: '#22304A',
        },
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: theme.palette.base.whiteAlpha[100],
      }}
    >
      <Typography
        sx={{
          fontSize: fontSizeText ? fontSizeText : 11,
          letterSpacing: '0.12em',
          color: '#94A3B8',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Typography>

      <Typography
        sx={{
          fontSize: fontSizeValue ? fontSizeValue : 22,
          fontWeight: 700,
          color: textColor ? textColor : '#FFFFFF',
          lineHeight: 1,
        }}
      >
        {value}
        {unit && (
          <Box
            component="span"
            sx={{
              fontSize: fontSizeUnit ? fontSizeUnit : 18,
              color: textColor ? textColor : '#94A3B8',
              ml: 0.5,
            }}
          >
            {unit}
          </Box>
        )}
      </Typography>
    </Box>
  );
};

export default StatCard;
