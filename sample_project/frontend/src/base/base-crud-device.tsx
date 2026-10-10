import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Grid as Grid2, useTheme } from '@mui/system';
import { useState } from 'react';

import { useDevices } from '@/hooks/use-device';
import type { DeviceType } from '@/services/building-device/device.model';
import deviceService from '@/services/building-device/device.service';

const DeviceTable = () => {
  const { devices, loading, totalCount, refetch, query, setQuery } = useDevices(
    {
      skip: 0,
      take: 10,
      sort: 'createdAt',
      order: 'desc',
    },
  );

  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const theme = useTheme();

  const handleChangePage = (_: unknown, newPage: number) => {
    setQuery((prev) => ({ ...prev, skip: newPage * (prev.take || 10) }));
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newTake = parseInt(event.target.value, 10);
    setQuery((prev) => ({ ...prev, take: newTake, skip: 0 }));
  };

  const handleSearch = () => {
    setQuery((prev) => ({
      ...prev,
      skip: 0,
      search: prev.search?.toLowerCase(),
    }));
  };

  const handleSearchKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const handleRowClick = async (deviceId: string | number) => {
    setDetailLoading(true);
    setOpenDialog(true);
    try {
      const response = await deviceService.getOne(deviceId);
      setSelectedDevice(response.data);
    } catch (error) {
      console.error('Error fetching device details:', error);
      setSelectedDevice(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedDevice(null);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'online':
        return 'success';
      case 'offline':
      case 'inactive':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  const renderDetailField = (label: string, value: any) => {
    if (value === null || value === undefined) return null;

    return (
      <Grid2 size={{ xs: 12, sm: 6 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 0.5 }}
        >
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {typeof value === 'object'
            ? JSON.stringify(value, null, 2)
            : String(value)}
        </Typography>
      </Grid2>
    );
  };

  return (
    <Box sx={{ height: '100%', width: '100%', p: 2 }}>
      <Paper
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid rgba(224, 224, 224, 0.8)',
            bgcolor: 'rgba(245, 245, 245, 0.6)',
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Danh sách thiết bị
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {/* Search */}
            <TextField
              size="small"
              placeholder="Tìm kiếm theo tên thiết bị..."
              value={query.search || ''}
              onChange={(e) =>
                setQuery((prev) => ({ ...prev, search: e.target.value }))
              }
              onKeyPress={handleSearchKeyPress}
              sx={{ minWidth: 250 }}
              InputProps={{
                endAdornment: (
                  <IconButton size="small" onClick={handleSearch}>
                    <SearchIcon />
                  </IconButton>
                ),
              }}
            />

            {/* Type Filter */}
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Loại thiết bị</InputLabel>
              <Select
                value={query.type || ''}
                label="Loại thiết bị"
                onChange={(e) => {
                  const value = e.target.value;
                  setQuery((prev) => ({
                    ...prev,
                    type: !value ? undefined : (value as DeviceType),
                    skip: 0,
                  }));
                }}
              >
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="CAMERA">Camera</MenuItem>
                <MenuItem value="FIRE_ALARM">Báo cháy</MenuItem>
                <MenuItem value="WATER_METER">Đồng hồ nước</MenuItem>
                <MenuItem value="ELECTRIC_METER">Đồng hồ điện</MenuItem>
                <MenuItem value="OTHER">Khác</MenuItem>
              </Select>
            </FormControl>

            {/* Sort */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Sắp xếp</InputLabel>
              <Select
                value={query.sort || 'createdAt'}
                label="Sắp xếp"
                onChange={(e) =>
                  setQuery((prev) => ({ ...prev, sort: e.target.value as any }))
                }
              >
                <MenuItem value="name">Tên</MenuItem>
                {/* <MenuItem value="type">Loại</MenuItem> */}
                <MenuItem value="status">Trạng thái</MenuItem>
                <MenuItem value="createdAt">Ngày tạo</MenuItem>
              </Select>
            </FormControl>

            {/* Order */}
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Thứ tự</InputLabel>
              <Select
                value={query.order || 'desc'}
                label="Thứ tự"
                onChange={(e) =>
                  setQuery((prev) => ({
                    ...prev,
                    order: e.target.value as 'asc' | 'desc',
                  }))
                }
              >
                <MenuItem value="asc">Tăng dần</MenuItem>
                <MenuItem value="desc">Giảm dần</MenuItem>
              </Select>
            </FormControl>

            {/* Refresh */}
            <IconButton onClick={refetch} color="primary" size="small">
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Table */}
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{ fontWeight: 600, bgcolor: 'rgba(220, 220, 220, 0.9)' }}
                >
                  ID
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 600, bgcolor: 'rgba(220, 220, 220, 0.9)' }}
                >
                  Tên thiết bị
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 600, bgcolor: 'rgba(220, 220, 220, 0.9)' }}
                >
                  Loại
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 600, bgcolor: 'rgba(220, 220, 220, 0.9)' }}
                >
                  Trạng thái
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 600, bgcolor: 'rgba(220, 220, 220, 0.9)' }}
                >
                  Ngày tạo
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : devices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">
                      Không có dữ liệu
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                devices.map((device) => (
                  <TableRow
                    key={device.id}
                    hover
                    onClick={() => handleRowClick(device.id)}
                    sx={{
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
                      bgcolor: theme.palette.base.whiteAlpha[500],
                      cursor: 'pointer',
                    }}
                  >
                    <TableCell>{device.id}</TableCell>
                    <TableCell>{device.name}</TableCell>
                    <TableCell>{device.type}</TableCell>
                    <TableCell>
                      <Chip
                        label={device.status}
                        size="small"
                        color={getStatusColor(device.status)}
                      />
                    </TableCell>
                    <TableCell>
                      {device.createdAt
                        ? new Date(device.createdAt).toLocaleString('vi-VN')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          component="div"
          count={totalCount}
          rowsPerPage={query.take || 10}
          page={Math.floor((query.skip || 0) / (query.take || 10))}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Số bản ghi mỗi trang:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} trong ${count}`
          }
        />
      </Paper>

      {/* Detail Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Chi tiết thiết bị
          </Typography>
          <IconButton onClick={handleCloseDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedDevice ? (
            <Box>
              <Grid2 container spacing={2}>
                {Object.entries(selectedDevice).map(([key, value]) =>
                  renderDetailField(
                    key.charAt(0).toUpperCase() +
                      key.slice(1).replace(/([A-Z])/g, ' $1'),
                    value,
                  ),
                )}
              </Grid2>
            </Box>
          ) : (
            <Typography color="text.secondary" align="center">
              Không có dữ liệu
            </Typography>
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog} variant="contained">
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DeviceTable;
