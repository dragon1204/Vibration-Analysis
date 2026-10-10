import {
  Box,
  Card,
  CardContent,
  type SxProps,
  type Theme,
  Typography,
} from '@mui/material';

import LocationPin from '@/components/LocationPin';
import useTranslation from '@/hooks/use-translation';
import { theme } from '@/theme';

const items = [
  { label: 'good', color: theme.palette.semantic.success.light },
  { label: 'normal', color: theme.palette.semantic.warning.light },
  { label: 'bad', color: theme.palette.semantic.error.light },
];

interface CardInfoProps {
  sx?: SxProps<Theme>;
}

const CardInfo = ({ sx }: CardInfoProps) => {
  const { t } = useTranslation();

  return (
    <Card
      elevation={8}
      sx={{
        width: '230px',
        height: '175px',
        borderRadius: 3,
        overflow: 'visible',
        boxShadow: '0 18px 40px rgba(2,40,36,0.6)',
        background: 'linear-gradient(90deg, #083a35 0%, #022e2b 100%)',
        border: '6px solid rgba(16,88,81,0.25)',
        ...sx,
      }}
    >
      <CardContent sx={{ padding: '12px 20px' }}>
        <Typography
          sx={{
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 20,
            mb: 1,
          }}
        >
          {t('status_annotation')}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {items.map((it) => (
            <Box
              key={it.label}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <LocationPin color={it.color} />
              <Typography
                sx={{
                  color: '#E6EFE9',
                  fontSize: 16,
                  fontWeight: 400,
                }}
              >
                {t(it.label as 'good' | 'normal' | 'bad')}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default CardInfo;
