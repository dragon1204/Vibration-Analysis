import { forwardRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  IconButton,
  Chip,
  Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import useTranslation from '@/hooks/use-translation';

interface PopupProps {
  open: boolean;
  onClose: () => void;
  buildings: Array<any>;
  onBuildingClick: (buildingSlug: string) => void;
}

const getStatusColor = (status: string) => {
  if (status === 'Tốt') return 'success';
  if (status === 'Không tốt') return 'error';
  return 'default';
};

const Popup = forwardRef<HTMLDivElement, PopupProps>(
  ({ open, onClose, buildings, onBuildingClick }, ref) => {
    const { t } = useTranslation();
    if (!open) return null;

    return (
      <Paper
        ref={ref}
        sx={{
          position: 'fixed',
          top: 80,
          right: 0,
          width: 300,
          maxWidth: '90vw',
          maxHeight: '70vh',
          boxShadow: 8,
          borderRadius: 3,
          zIndex: 1200,
          px: 2,
          py: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
        elevation={12}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>
            {t('building_list')}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <List dense disablePadding sx={{ overflowY: 'auto', flex: 1 }}>
          {buildings.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
              {t('no_buildings')}
            </Typography>
          )}
          {buildings.map((b) => (
            <ListItem key={b.id} disablePadding sx={{ mb: 1, borderRadius: 1 }}>
              <ListItemButton
                onClick={() => onBuildingClick(b.slug)}
                sx={{ px: 2, py: 1, borderRadius: 1 }}
              >
                <Stack direction="row" alignItems="center" spacing={2} width="100%">
                  <Box flex={1}>
                    <Typography fontWeight={600} fontSize={15}>
                      {b.buildingName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {b.projectName}
                    </Typography>
                  </Box>
                  <Chip
                    label={b.status}
                    color={getStatusColor(b.status)}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Stack>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Paper>
    );
  }
);

export default Popup;