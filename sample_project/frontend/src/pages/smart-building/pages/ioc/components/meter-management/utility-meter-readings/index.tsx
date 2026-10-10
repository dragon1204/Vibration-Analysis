import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DoNotDisturbOnOutlinedIcon from '@mui/icons-material/DoNotDisturbOnOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Popover,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ExcelJS from 'exceljs';
import { AnimatePresence, motion } from 'framer-motion';
import { ImageIcon, Save, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useEffect, useRef, useState } from 'react';

import { httpService } from '@/base/http-service';
import {
  type Meter,
  meterService,
} from '@/services/ioc/meter-management/meter.service';
import {
  type UtilityMeterReading,
  UtilityMeterReadingStatus,
  utilityMeterReadingService,
} from '@/services/ioc/meter-management/utility-meter-reading.service';
import { baseColors } from '@/theme/baseColors';
import { semanticColors } from '@/theme/semanticColors';

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '12px 16px',
  background: baseColors.whiteAlpha[50],
  border: `1px solid ${baseColors.whiteAlpha[100]}`,
  borderRadius: 8,
  color: semanticColors.info.text,
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s',
};

const statusLabels: Record<number, string> = {
  [UtilityMeterReadingStatus.Pending]: 'Chờ duyệt',
  [UtilityMeterReadingStatus.Approved]: 'Đã duyệt',
  [UtilityMeterReadingStatus.Rejected]: 'Từ chối',
};

const statusColors: Record<number, { bg: string; color: string }> = {
  [UtilityMeterReadingStatus.Pending]: {
    bg: semanticColors.warning.background,
    color: semanticColors.warning.text,
  },
  [UtilityMeterReadingStatus.Approved]: {
    bg: semanticColors.success.background,
    color: semanticColors.success.text,
  },
  [UtilityMeterReadingStatus.Rejected]: {
    bg: semanticColors.error.background,
    color: semanticColors.error.text,
  },
};

const formatMonth = (dateStr: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const formatNumber = (val: number | undefined) => {
  if (val === undefined || val === null) return '—';
  return val.toLocaleString('vi-VN');
};

const UtilityMeterReadingPanel = () => {
  const { enqueueSnackbar } = useSnackbar();

  const [data, setData] = useState<UtilityMeterReading[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Meters for dropdown
  const [meters, setMeters] = useState<Meter[]>([]);

  // Filter state
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<
    UtilityMeterReadingStatus | ''
  >('');
  const [meterIdFilter, setMeterIdFilter] = useState<number | ''>('');
  const [readingMonthFilter, setReadingMonthFilter] = useState<string>(''); // "YYYY-MM"
  const [pendingStatusFilter, setPendingStatusFilter] = useState<
    UtilityMeterReadingStatus | ''
  >('');
  const [pendingMeterIdFilter, setPendingMeterIdFilter] = useState<number | ''>(
    '',
  );
  const [pendingReadingMonthFilter, setPendingReadingMonthFilter] =
    useState<string>('');

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<UtilityMeterReading | null>(
    null,
  );

  // Modal state
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(
    null,
  );
  const [draft, setDraft] = useState<Partial<UtilityMeterReading> | null>(null);

  // Image upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageFileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    imageFileRef.current = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setImagePreview(url);
      setDraft((d) => (d ? { ...d, readingImageUrl: url } : d));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    imageFileRef.current = null;
    setImagePreview(null);
    setDraft((d) => (d ? { ...d, readingImageUrl: '' } : d));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Fetch meters for dropdown
  useEffect(() => {
    const fetchMeters = async () => {
      try {
        const res = await meterService.getMeters(0, 5000);
        setMeters(res.items || []);
      } catch (err) {
        console.error('Failed to fetch meters:', err);
      }
    };

    fetchMeters();
  }, []);

  // Fetch data
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await utilityMeterReadingService.getAll(
          page * rowsPerPage,
          rowsPerPage,
          search,
          statusFilter !== '' ? statusFilter : undefined,
          meterIdFilter !== '' ? meterIdFilter : undefined,
          readingMonthFilter !== '' ? readingMonthFilter : undefined,
        );
        if (active) {
          setData(res.items || []);
          setTotalCount(res.totalCount || 0);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, [
    page,
    rowsPerPage,
    search,
    statusFilter,
    meterIdFilter,
    readingMonthFilter,
    refreshTrigger,
  ]);

  // Filter handlers
  const handleOpenFilter = (event: React.MouseEvent<HTMLElement>) => {
    setPendingStatusFilter(statusFilter);
    setPendingMeterIdFilter(meterIdFilter);
    setPendingReadingMonthFilter(readingMonthFilter);
    setFilterAnchorEl(event.currentTarget);
  };

  const handleCloseFilter = () => setFilterAnchorEl(null);

  const handleApplyFilter = () => {
    setStatusFilter(pendingStatusFilter);
    setMeterIdFilter(pendingMeterIdFilter);
    setReadingMonthFilter(pendingReadingMonthFilter);
    setPage(0);
    handleCloseFilter();
  };

  const handleResetFilter = () => {
    setPendingStatusFilter('');
    setPendingMeterIdFilter('');
    setPendingReadingMonthFilter('');
    setStatusFilter('');
    setMeterIdFilter('');
    setReadingMonthFilter('');
    setPage(0);
    handleCloseFilter();
  };

  // Menu handlers
  const handleOpenMenu = (
    event: React.MouseEvent<HTMLElement>,
    row: UtilityMeterReading,
  ) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  // Modal handlers
  const handleOpenAdd = () => {
    const now = new Date();
    setDraft({
      meterId: 0,
      previousReading: 0,
      currentReading: 0,
      readingMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      readingImageUrl: '',
      apartmentId: 0,
      // buildingId: 0,
    });
    setImagePreview(null);
    imageFileRef.current = null;
    setModalMode('add');
  };

  const handleOpenView = (item: UtilityMeterReading) => {
    setDraft(item);
    setImagePreview(item.readingImageUrl || null);
    imageFileRef.current = null;
    setModalMode('view');
  };

  const handleOpenEdit = (item: UtilityMeterReading) => {
    setDraft(item);
    setImagePreview(item.readingImageUrl || null);
    imageFileRef.current = null;
    setModalMode('edit');
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setDraft(null);
    setImagePreview(null);
    imageFileRef.current = null;
  };

  const handleSave = async () => {
    if (!draft || !draft.meterId) {
      enqueueSnackbar('Vui lòng chọn đồng hồ', { variant: 'warning' });
      return;
    }
    if ((draft.previousReading ?? 0) < 0) {
      enqueueSnackbar('Chỉ số cũ phải lớn hơn hoặc bằng 0', {
        variant: 'warning',
      });
      return;
    }
    if ((draft.currentReading ?? 0) < 0) {
      enqueueSnackbar('Chỉ số mới phải lớn hơn hoặc bằng 0', {
        variant: 'warning',
      });
      return;
    }
    if ((draft.currentReading ?? 0) < (draft.previousReading ?? 0)) {
      enqueueSnackbar('Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ', {
        variant: 'warning',
      });
      return;
    }

    try {
      let readingImageUrl = draft.readingImageUrl ?? '';

      if (imageFileRef.current) {
        const uploadResult = await httpService.uploadBatchMinIoCms({
          files: [imageFileRef.current],
        });
        readingImageUrl = uploadResult?.result?.[0] ?? readingImageUrl;
      }

      const payload = { ...draft, readingImageUrl };

      if (modalMode === 'add') {
        await utilityMeterReadingService.create(payload);
        enqueueSnackbar('Thêm mới thành công', { variant: 'success' });
      } else if (modalMode === 'edit') {
        await utilityMeterReadingService.update(payload);
        enqueueSnackbar('Cập nhật thành công', { variant: 'success' });
      }
      handleCloseModal();
      setRefreshTrigger((prev) => prev + 1);
    } catch (_e: any) {
      const message =
        _e?.response?.data?.error?.message || 'Có lỗi xảy ra khi lưu dữ liệu';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const handleDelete = async (item: UtilityMeterReading) => {
    if (item.status !== UtilityMeterReadingStatus.Pending) {
      enqueueSnackbar('Chỉ có thể xóa bản ghi có trạng thái "Chờ duyệt"', {
        variant: 'warning',
      });
      return;
    }
    if (confirm('Bạn có chắc chắn muốn xoá mục này?')) {
      try {
        if (item.id) await utilityMeterReadingService.delete(item.id);
        enqueueSnackbar('Xoá thành công', { variant: 'success' });
        setRefreshTrigger((prev) => prev + 1);
      } catch (_e) {
        enqueueSnackbar('Có lỗi xảy ra khi xoá', { variant: 'error' });
      }
    }
  };

  const handleSetStatus = async (
    item: UtilityMeterReading,
    status: UtilityMeterReadingStatus,
  ) => {
    const label =
      status === UtilityMeterReadingStatus.Approved ? 'duyệt' : 'từ chối';
    if (confirm(`Bạn có chắc chắn muốn ${label} bản ghi này?`)) {
      try {
        if (item.id)
          await utilityMeterReadingService.setStatus(item.id, status);
        enqueueSnackbar(
          `${status === UtilityMeterReadingStatus.Approved ? 'Duyệt' : 'Từ chối'} thành công`,
          { variant: 'success' },
        );
        setRefreshTrigger((prev) => prev + 1);
      } catch (_e: any) {
        const message = _e?.response?.data?.error?.message || 'Có lỗi xảy ra';
        enqueueSnackbar(message, { variant: 'error' });
      }
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await utilityMeterReadingService.getAll(0, 5000, search);
      const exportData = res.items || [];

      if (exportData.length === 0) {
        enqueueSnackbar('Không có dữ liệu để xuất', { variant: 'warning' });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Bản ghi chỉ số');

      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      const headers = [
        'STT',
        'Mã đồng hồ',
        'Tên đồng hồ',
        'Chỉ số cũ',
        'Chỉ số mới',
        'Tiêu thụ',
        'Tháng ghi',
        'Hình ảnh',
        'Trạng thái',
      ];
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 12 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD9E1F2' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = thinBorder;
      });

      exportData.forEach((item, index) => {
        const row = worksheet.addRow([
          index + 1,
          item.meterCode || '',
          item.meterName || '',
          item.previousReading ?? 0,
          item.currentReading ?? 0,
          (item.currentReading ?? 0) - (item.previousReading ?? 0),
          formatMonth(item.readingMonth),
          item.readingImageUrl || '',
          statusLabels[item.status] || '',
        ]);
        row.eachCell((cell) => {
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle' };
        });
      });

      worksheet.columns.forEach((column) => {
        let maxLength = 10;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const cellLength = cell.value ? String(cell.value).length : 0;
          if (cellLength > maxLength) maxLength = cellLength;
        });
        column.width = Math.min(maxLength + 4, 50);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `BanGhi_ChiSo_${new Date().getTime()}.xlsx`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      enqueueSnackbar('Xuất file thành công', { variant: 'success' });
    } catch (_e) {
      enqueueSnackbar('Đã có lỗi xảy ra khi xuất file', { variant: 'error' });
    }
  };

  const getFormTitle = () => {
    const action =
      modalMode === 'add'
        ? 'Thêm mới'
        : modalMode === 'view'
          ? 'Chi tiết'
          : 'Sửa';
    return `${action} Bản ghi chỉ số`;
  };

  const isPending = (item: UtilityMeterReading) =>
    item.status === UtilityMeterReadingStatus.Pending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        width: '100%',
        height: '100%',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1.5,
        }}
      >
        <Typography
          variant="h5"
          sx={{ color: baseColors.text.primary, fontWeight: 700 }}
        >
          Bản ghi chỉ số
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            onClick={handleOpenAdd}
            variant="contained"
            startIcon={<AddIcon />}
            sx={{
              bgcolor: semanticColors.info.light,
              color: semanticColors.info.text,
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              px: 3,
              py: 1,
              boxShadow: 'none',
              '&:hover': {
                bgcolor: semanticColors.info.main,
                boxShadow: 'none',
              },
            }}
          >
            Thêm
          </Button>
          <Button
            onClick={handleExportExcel}
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            sx={{
              color: baseColors.text.secondary,
              borderColor: baseColors.whiteAlpha[100],
              fontWeight: 500,
              textTransform: 'none',
              borderRadius: 2,
              px: 3,
              py: 1,
              bgcolor: baseColors.whiteAlpha[50],
              '&:hover': {
                borderColor: baseColors.whiteAlpha[300],
                bgcolor: baseColors.whiteAlpha[100],
              },
            }}
          >
            Xuất Excel
          </Button>
        </Box>
      </Box>

      {/* Search + Filter */}
      <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
        <TextField
          fullWidth
          placeholder="Tìm kiếm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            flex: 1,
            '& .MuiOutlinedInput-root': {
              color: baseColors.text.primary,
              bgcolor: baseColors.slateDarkAlpha[400],
              borderRadius: 2,
              height: '46px',
              '& fieldset': { borderColor: baseColors.whiteAlpha[100] },
              '&:hover fieldset': { borderColor: baseColors.whiteAlpha[200] },
              '&.Mui-focused fieldset': {
                borderColor: semanticColors.info.main,
              },
            },
            '& .MuiInputBase-input::placeholder': {
              color: baseColors.text.secondary,
              opacity: 1,
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon
                  sx={{ color: baseColors.text.secondary, fontSize: 20 }}
                />
              </InputAdornment>
            ),
          }}
        />
        {/* ── Filter Button ── */}
        <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
          <Box sx={{ position: 'relative' }}>
            <Button
              variant="outlined"
              startIcon={<FilterAltOutlinedIcon />}
              onClick={handleOpenFilter}
              sx={{
                color: baseColors.text.secondary,
                borderColor: baseColors.whiteAlpha[100],
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 2,
                px: 3,
                minWidth: 100,
                height: '46px',
                bgcolor: baseColors.whiteAlpha[50],
                '&:hover': {
                  borderColor: baseColors.whiteAlpha[300],
                  bgcolor: baseColors.whiteAlpha[100],
                },
              }}
            >
              Lọc
            </Button>
          </Box>
        </Box>

        {/* Filter Popover */}
        <Popover
          open={Boolean(filterAnchorEl)}
          anchorEl={filterAnchorEl}
          onClose={handleCloseFilter}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{
            sx: {
              mt: 0.75,
              bgcolor: baseColors.background.default,
              border: `1px solid ${baseColors.whiteAlpha[100]}`,
              borderRadius: 2,
              boxShadow: `0 8px 32px ${baseColors.blackAlpha[500]}`,
              minWidth: 600,
              overflow: 'visible',
            },
          }}
        >
          <Box sx={{ p: 2.5 }}>
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
              }}
            >
              <Typography
                sx={{
                  color: baseColors.text.primary,
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Bộ lọc
              </Typography>
              <Box
                component="button"
                onClick={handleCloseFilter}
                sx={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: baseColors.slateLightAlpha[600],
                  display: 'flex',
                  p: 0.25,
                  '&:hover': { color: baseColors.text.secondary },
                }}
              >
                <X size={16} />
              </Box>
            </Box>

            {/* 3 filter nằm ngang */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Trạng thái */}
              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    color: baseColors.text.secondary,
                    fontSize: 12,
                    mb: 1,
                    fontWeight: 500,
                  }}
                >
                  Trạng thái
                </Typography>
                <Select
                  fullWidth
                  displayEmpty
                  size="small"
                  value={pendingStatusFilter}
                  onChange={(e) =>
                    setPendingStatusFilter(
                      e.target.value as UtilityMeterReadingStatus | '',
                    )
                  }
                  renderValue={(value) =>
                    !value ? (
                      <Typography
                        sx={{ color: baseColors.text.secondary, fontSize: 14 }}
                      >
                        Chọn trạng thái
                      </Typography>
                    ) : (
                      <Typography
                        sx={{ color: semanticColors.info.text, fontSize: 14 }}
                      >
                        {statusLabels[value as UtilityMeterReadingStatus]}
                      </Typography>
                    )
                  }
                  endAdornment={
                    pendingStatusFilter !== '' ? (
                      <InputAdornment position="end" sx={{ mr: 2 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingStatusFilter('');
                          }}
                          sx={{
                            p: 0.25,
                            color: baseColors.text.secondary,
                            '&:hover': { color: baseColors.text.primary },
                          }}
                        >
                          <X size={14} />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined
                  }
                  sx={{
                    color:
                      pendingStatusFilter !== ''
                        ? semanticColors.info.text
                        : baseColors.text.secondary,
                    fontSize: 14,
                    height: 40,
                    bgcolor: baseColors.whiteAlpha[50],
                    borderRadius: 1.5,
                    '& .MuiSelect-icon': { color: baseColors.text.secondary },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: baseColors.whiteAlpha[100],
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: baseColors.whiteAlpha[200],
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: semanticColors.info.main,
                    },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: baseColors.background.default,
                        border: `1px solid ${baseColors.whiteAlpha[100]}`,
                        borderRadius: 1.5,
                        mt: 0.5,
                        '& .MuiMenuItem-root': {
                          fontSize: 14,
                          color: baseColors.text.primary,
                          '&:hover': { bgcolor: baseColors.whiteAlpha[100] },
                          '&.Mui-selected': {
                            bgcolor: semanticColors.info.background,
                            color: semanticColors.info.main,
                            '&:hover': {
                              bgcolor: semanticColors.info.background,
                            },
                          },
                        },
                      },
                    },
                  }}
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <MenuItem key={value} value={Number(value)}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              {/* Đồng hồ */}
              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    color: baseColors.text.secondary,
                    fontSize: 12,
                    mb: 1,
                    fontWeight: 500,
                  }}
                >
                  Đồng hồ
                </Typography>
                <Select
                  fullWidth
                  displayEmpty
                  size="small"
                  value={pendingMeterIdFilter}
                  onChange={(e) =>
                    setPendingMeterIdFilter(e.target.value as number | '')
                  }
                  renderValue={(value) =>
                    !value ? (
                      <Typography
                        sx={{ color: baseColors.text.secondary, fontSize: 14 }}
                      >
                        Chọn đồng hồ
                      </Typography>
                    ) : (
                      <Typography
                        sx={{ color: semanticColors.info.text, fontSize: 14 }}
                      >
                        {meters.find((m) => m.id === value)?.name ?? ''}
                      </Typography>
                    )
                  }
                  endAdornment={
                    pendingMeterIdFilter !== '' ? (
                      <InputAdornment position="end" sx={{ mr: 2 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingMeterIdFilter('');
                          }}
                          sx={{
                            p: 0.25,
                            color: baseColors.text.secondary,
                            '&:hover': { color: baseColors.text.primary },
                          }}
                        >
                          <X size={14} />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined
                  }
                  sx={{
                    color:
                      pendingMeterIdFilter !== ''
                        ? semanticColors.info.text
                        : baseColors.text.secondary,
                    fontSize: 14,
                    height: 40,
                    bgcolor: baseColors.whiteAlpha[50],
                    borderRadius: 1.5,
                    '& .MuiSelect-icon': { color: baseColors.text.secondary },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: baseColors.whiteAlpha[100],
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: baseColors.whiteAlpha[200],
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: semanticColors.info.main,
                    },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: baseColors.background.default,
                        border: `1px solid ${baseColors.whiteAlpha[100]}`,
                        borderRadius: 1.5,
                        mt: 0.5,
                        maxHeight: 240,
                        '& .MuiMenuItem-root': {
                          fontSize: 14,
                          color: baseColors.text.primary,
                          '&:hover': { bgcolor: baseColors.whiteAlpha[100] },
                          '&.Mui-selected': {
                            bgcolor: semanticColors.info.background,
                            color: semanticColors.info.main,
                            '&:hover': {
                              bgcolor: semanticColors.info.background,
                            },
                          },
                        },
                      },
                    },
                  }}
                >
                  {meters.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name}
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              {/* Tháng ghi */}
              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    color: baseColors.text.secondary,
                    fontSize: 12,
                    mb: 1,
                    fontWeight: 500,
                  }}
                >
                  Tháng ghi
                </Typography>
                <Box sx={{ position: 'relative' }}>
                  <input
                    type="month"
                    value={pendingReadingMonthFilter}
                    onChange={(e) =>
                      setPendingReadingMonthFilter(e.target.value)
                    }
                    style={{
                      ...fieldStyle,
                      height: 40,
                      padding: '0 12px',
                      borderColor: pendingReadingMonthFilter
                        ? semanticColors.info.main
                        : baseColors.whiteAlpha[100],
                      colorScheme: 'dark',
                    }}
                  />
                  {pendingReadingMonthFilter && (
                    <Box
                      component="button"
                      onClick={() => setPendingReadingMonthFilter('')}
                      sx={{
                        position: 'absolute',
                        right: 32,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: baseColors.text.secondary,
                        display: 'flex',
                        p: 0,
                        '&:hover': { color: baseColors.text.primary },
                      }}
                    >
                      <X size={14} />
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 1, mt: 2.5 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleResetFilter}
                sx={{
                  color: baseColors.text.secondary,
                  borderColor: baseColors.whiteAlpha[100],
                  fontWeight: 500,
                  textTransform: 'none',
                  borderRadius: 1.5,
                  fontSize: 13,
                  py: 0.75,
                  bgcolor: 'transparent',
                  '&:hover': {
                    borderColor: baseColors.whiteAlpha[200],
                    bgcolor: baseColors.whiteAlpha[50],
                  },
                }}
              >
                Bỏ lọc
              </Button>
              <Button
                fullWidth
                variant="contained"
                onClick={handleApplyFilter}
                sx={{
                  bgcolor: semanticColors.info.main,
                  color: baseColors.background.default,
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 1.5,
                  fontSize: 13,
                  py: 0.75,
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: semanticColors.info.light,
                    boxShadow: 'none',
                  },
                }}
              >
                Lưu
              </Button>
            </Box>
          </Box>
        </Popover>
      </Box>

      {/* Table */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: baseColors.slateDarkAlpha[600],
          borderRadius: 3,
          border: `1px solid ${baseColors.whiteAlpha[50]}`,
          overflow: 'hidden',
          backdropFilter: 'blur(16px)',
        }}
      >
        <TableContainer
          sx={{
            flex: 1,
            overflow: 'auto',
            '&::-webkit-scrollbar': { width: '6px', height: '6px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              background: baseColors.whiteAlpha[100],
              borderRadius: '8px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: baseColors.whiteAlpha[200],
            },
          }}
        >
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {[
                  { label: 'STT', align: 'left' as const, pl: 4, width: 80 },
                  { label: 'MÃ ĐỒNG HỒ', align: 'left' as const },
                  { label: 'TÊN ĐỒNG HỒ', align: 'left' as const },
                  { label: 'CHỈ SỐ CŨ', align: 'left' as const },
                  { label: 'CHỈ SỐ MỚI', align: 'left' as const },
                  { label: 'TIÊU THỤ', align: 'left' as const },
                  { label: 'THÁNG GHI', align: 'left' as const },
                  { label: 'TRẠNG THÁI', align: 'left' as const },
                  { label: 'HÀNH ĐỘNG', align: 'right' as const, pr: 4 },
                ].map(({ label, align, pl, pr, width }) => (
                  <TableCell
                    key={label}
                    align={align}
                    sx={{
                      bgcolor: baseColors.background.paper,
                      color: baseColors.text.secondary,
                      fontWeight: 600,
                      fontSize: 12,
                      borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                      py: 2,
                      ...(pl ? { pl } : {}),
                      ...(pr ? { pr } : {}),
                      ...(width ? { width } : {}),
                    }}
                  >
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <AnimatePresence>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      align="center"
                      sx={{ py: 8, borderBottom: 'none' }}
                    >
                      <CircularProgress
                        size={30}
                        sx={{ color: semanticColors.info.main }}
                      />
                    </TableCell>
                  </TableRow>
                ) : data.length > 0 ? (
                  data.map((row, index) => {
                    const statusStyle =
                      statusColors[row.status] ||
                      statusColors[UtilityMeterReadingStatus.Pending];
                    const consumption =
                      (row.currentReading ?? 0) - (row.previousReading ?? 0);
                    return (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: index * 0.03 }}
                        style={{ transition: 'background-color 0.2s' }}
                        className="hover:bg-white/5"
                      >
                        <TableCell
                          sx={{
                            color: semanticColors.info.text,
                            fontWeight: 500,
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                            pl: 4,
                          }}
                        >
                          {page * rowsPerPage + index + 1}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: semanticColors.info.main,
                            fontWeight: 500,
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                          }}
                        >
                          {row.meterCode || '—'}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: semanticColors.info.text,
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                          }}
                        >
                          {row.meterName || '—'}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: semanticColors.info.text,
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                          }}
                        >
                          {formatNumber(row.previousReading)}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: semanticColors.info.text,
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                          }}
                        >
                          {formatNumber(row.currentReading)}
                        </TableCell>
                        <TableCell
                          sx={{
                            color:
                              consumption > 0
                                ? semanticColors.success.main
                                : semanticColors.info.text,
                            fontWeight: 600,
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                          }}
                        >
                          {formatNumber(consumption)}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: semanticColors.info.text,
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                          }}
                        >
                          {formatMonth(row.readingMonth)}
                        </TableCell>
                        <TableCell
                          sx={{
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                          }}
                        >
                          <Chip
                            label={statusLabels[row.status] || 'Khác'}
                            size="small"
                            sx={{
                              bgcolor: statusStyle.bg,
                              color: statusStyle.color,
                              fontWeight: 600,
                              fontSize: 12,
                              height: 26,
                              minWidth: 90,
                              border: `1px solid ${statusStyle.color}30`,
                            }}
                          />
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                            pr: 4,
                          }}
                        >
                          <IconButton
                            size="small"
                            onClick={(e) => handleOpenMenu(e, row)}
                            sx={{
                              color: semanticColors.info.text,
                              '&:hover': {
                                color: baseColors.text.primary,
                                bgcolor: baseColors.whiteAlpha[100],
                              },
                            }}
                          >
                            <MoreVertIcon
                              fontSize="small"
                              sx={{ fontSize: 20 }}
                            />
                          </IconButton>
                        </TableCell>
                      </motion.tr>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      align="center"
                      sx={{ py: 8, borderBottom: 'none' }}
                    >
                      <Typography sx={{ color: baseColors.text.secondary }}>
                        Không có dữ liệu
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2,
            borderTop: `1px solid ${baseColors.whiteAlpha[50]}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ color: semanticColors.info.text, fontSize: 13 }}>
              Số hàng mỗi trang:
            </Typography>
            <Select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(e.target.value as number);
                setPage(0);
              }}
              size="small"
              sx={{
                color: semanticColors.info.text,
                fontSize: 13,
                height: 32,
                bgcolor: baseColors.whiteAlpha[50],
                '& .MuiSelect-icon': { color: baseColors.text.secondary },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: baseColors.whiteAlpha[100],
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: baseColors.whiteAlpha[200],
                },
              }}
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
            </Select>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Typography sx={{ color: semanticColors.info.text, fontSize: 13 }}>
              {totalCount === 0
                ? '0-0 trên 0'
                : `${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, totalCount)} trên ${totalCount}`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                sx={{
                  color: baseColors.text.primary,
                  borderColor: baseColors.whiteAlpha[100],
                  bgcolor: baseColors.whiteAlpha[50],
                  textTransform: 'none',
                  minWidth: 'unset',
                  px: 2,
                  py: 0.5,
                  '&.Mui-disabled': {
                    color: baseColors.slateLightAlpha[300],
                    borderColor: baseColors.whiteAlpha[50],
                  },
                }}
              >
                Trước
              </Button>
              <Button
                variant="outlined"
                disabled={(page + 1) * rowsPerPage >= totalCount}
                onClick={() => setPage(page + 1)}
                sx={{
                  color: baseColors.text.primary,
                  borderColor: baseColors.whiteAlpha[100],
                  bgcolor: baseColors.whiteAlpha[50],
                  textTransform: 'none',
                  minWidth: 'unset',
                  px: 2,
                  py: 0.5,
                  '&.Mui-disabled': {
                    color: baseColors.slateLightAlpha[300],
                    borderColor: baseColors.whiteAlpha[50],
                  },
                }}
              >
                Sau
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            bgcolor: baseColors.slateDarkAlpha[900],
            backdropFilter: 'blur(10px)',
            border: `1px solid ${baseColors.whiteAlpha[100]}`,
            color: baseColors.text.primary,
            boxShadow: `0 8px 32px ${baseColors.blackAlpha[500]}`,
            borderRadius: 2,
            minWidth: 140,
            mt: 0.5,
            '& .MuiMenuItem-root': {
              fontSize: 14,
              px: 3,
              py: 1.5,
              fontWeight: 500,
              '&:hover': { bgcolor: baseColors.whiteAlpha[100] },
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            handleCloseMenu();
            if (selectedRow) handleOpenView(selectedRow);
          }}
        >
          <VisibilityOutlinedIcon
            fontSize="small"
            sx={{ mr: 1.5, color: semanticColors.info.text }}
          />
          Xem
        </MenuItem>
        {selectedRow && isPending(selectedRow) && (
          <MenuItem
            onClick={() => {
              handleCloseMenu();
              if (selectedRow) handleOpenEdit(selectedRow);
            }}
            sx={{
              color: semanticColors.info.main,
              '&:hover': {
                bgcolor: `${semanticColors.info.background} !important`,
              },
            }}
          >
            <EditOutlinedIcon
              fontSize="small"
              sx={{ mr: 1.5, color: semanticColors.info.main }}
            />
            Sửa
          </MenuItem>
        )}
        {selectedRow && isPending(selectedRow) && (
          <MenuItem
            onClick={() => {
              handleCloseMenu();
              if (selectedRow)
                handleSetStatus(
                  selectedRow,
                  UtilityMeterReadingStatus.Approved,
                );
            }}
            sx={{
              color: semanticColors.success.main,
              '&:hover': {
                bgcolor: `${semanticColors.success.background} !important`,
              },
            }}
          >
            <CheckCircleOutlineIcon fontSize="small" sx={{ mr: 1.5 }} />
            Duyệt
          </MenuItem>
        )}
        {selectedRow && isPending(selectedRow) && (
          <MenuItem
            onClick={() => {
              handleCloseMenu();
              if (selectedRow)
                handleSetStatus(
                  selectedRow,
                  UtilityMeterReadingStatus.Rejected,
                );
            }}
            sx={{
              color: semanticColors.warning.main,
              '&:hover': {
                bgcolor: `${semanticColors.warning.background} !important`,
              },
            }}
          >
            <DoNotDisturbOnOutlinedIcon fontSize="small" sx={{ mr: 1.5 }} />
            Từ chối
          </MenuItem>
        )}
        {selectedRow && isPending(selectedRow) && (
          <MenuItem
            onClick={() => {
              handleCloseMenu();
              if (selectedRow) handleDelete(selectedRow);
            }}
            sx={{
              color: semanticColors.error.main,
              '&:hover': {
                bgcolor: `${semanticColors.error.backgroundLight} !important`,
              },
            }}
          >
            <DeleteOutlineIcon fontSize="small" sx={{ mr: 1.5 }} />
            Xóa
          </MenuItem>
        )}
      </Menu>

      {/* Add / Edit / View Modal */}
      <Dialog
        open={!!modalMode}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: baseColors.background.default,
            border: `1px solid ${baseColors.cyanAlpha[150]}`,
            borderRadius: 3,
            boxShadow: `0 25px 60px ${baseColors.blackAlpha[800]}`,
          },
        }}
        sx={{ '& .MuiDialog-container': { alignItems: 'center' } }}
      >
        {/* Modal Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            pt: 3,
            pb: 2,
          }}
        >
          <Typography
            sx={{
              color: semanticColors.info.light,
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            {getFormTitle()}
          </Typography>
          <Box
            component="button"
            onClick={handleCloseModal}
            sx={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: baseColors.slateLightAlpha[600],
              display: 'flex',
              p: 0.5,
              '&:hover': { color: baseColors.text.secondary },
            }}
          >
            <X size={20} />
          </Box>
        </Box>

        {/* Modal Body */}
        <Box
          sx={{
            px: 3,
            pb: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
          }}
        >
          {/* Đồng hồ */}
          <Box>
            <Typography
              sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
            >
              Đồng hồ{' '}
              {modalMode !== 'view' && (
                <span style={{ color: semanticColors.error.main }}>*</span>
              )}
            </Typography>
            <select
              disabled={modalMode === 'view'}
              style={{
                ...fieldStyle,
                opacity: modalMode === 'view' ? 0.7 : 1,
                cursor: modalMode === 'view' ? 'not-allowed' : 'pointer',
              }}
              value={draft?.meterId ?? ''}
              onChange={(e) =>
                setDraft((d) =>
                  d ? { ...d, meterId: Number(e.target.value) } : d,
                )
              }
            >
              <option
                value=""
                style={{ background: baseColors.background.default }}
              >
                -- Chọn đồng hồ --
              </option>
              {meters.map((m) => (
                <option
                  key={m.id}
                  value={m.id}
                  style={{ background: baseColors.background.default }}
                >
                  {m.name}
                </option>
              ))}
            </select>
          </Box>

          {/* Chỉ số cũ + Chỉ số mới */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography
                sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
              >
                Chỉ số cũ
              </Typography>
              <input
                type="number"
                min={0}
                style={{
                  ...fieldStyle,
                  opacity: modalMode === 'view' ? 0.7 : 1,
                }}
                value={draft?.previousReading ?? 0}
                readOnly={modalMode === 'view'}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, previousReading: Number(e.target.value) } : d,
                  )
                }
                onFocus={(e) => {
                  if (modalMode !== 'view')
                    e.target.style.borderColor = semanticColors.info.main;
                }}
                onBlur={(e) =>
                  (e.target.style.borderColor = baseColors.whiteAlpha[100])
                }
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography
                sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
              >
                Chỉ số mới{' '}
                {modalMode !== 'view' && (
                  <span style={{ color: semanticColors.error.main }}>*</span>
                )}
              </Typography>
              <input
                type="number"
                min={0}
                style={{
                  ...fieldStyle,
                  opacity: modalMode === 'view' ? 0.7 : 1,
                }}
                value={draft?.currentReading ?? 0}
                readOnly={modalMode === 'view'}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, currentReading: Number(e.target.value) } : d,
                  )
                }
                onFocus={(e) => {
                  if (modalMode !== 'view')
                    e.target.style.borderColor = semanticColors.info.main;
                }}
                onBlur={(e) =>
                  (e.target.style.borderColor = baseColors.whiteAlpha[100])
                }
              />
            </Box>
          </Box>

          {/* Tháng ghi chỉ số */}
          <Box>
            <Typography
              sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
            >
              Tháng ghi chỉ số
            </Typography>
            <input
              type="month"
              style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }}
              value={
                draft?.readingMonth ? draft.readingMonth.substring(0, 7) : ''
              }
              readOnly={modalMode === 'view'}
              onChange={(e) =>
                setDraft((d) =>
                  d ? { ...d, readingMonth: e.target.value + '-01' } : d,
                )
              }
              onFocus={(e) => {
                if (modalMode !== 'view')
                  e.target.style.borderColor = semanticColors.info.main;
              }}
              onBlur={(e) =>
                (e.target.style.borderColor = baseColors.whiteAlpha[100])
              }
            />
          </Box>

          {/* Hình ảnh */}
          <Box>
            <Typography
              sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
            >
              Hình ảnh
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />
            {imagePreview ? (
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Box
                  component="img"
                  src={imagePreview}
                  alt="Ảnh chụp chỉ số"
                  sx={{
                    width: 160,
                    height: 160,
                    objectFit: 'cover',
                    borderRadius: 2,
                    border: `1px solid ${baseColors.whiteAlpha[100]}`,
                  }}
                />
                {modalMode !== 'view' && (
                  <Box
                    component="button"
                    onClick={handleRemoveImage}
                    sx={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: `${semanticColors.error.main}E6`,
                      border: 'none',
                      color: baseColors.text.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      p: 0,
                      '&:hover': { bgcolor: semanticColors.error.main },
                    }}
                  >
                    <X size={14} />
                  </Box>
                )}
              </Box>
            ) : (
              <Box
                onClick={() => {
                  if (modalMode !== 'view') fileInputRef.current?.click();
                }}
                sx={{
                  width: 160,
                  height: 160,
                  border: `2px dashed ${baseColors.whiteAlpha[100]}`,
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  cursor: modalMode === 'view' ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                  '&:hover':
                    modalMode !== 'view'
                      ? {
                          borderColor: baseColors.cyanAlpha[400],
                          bgcolor: baseColors.cyanAlpha[100],
                        }
                      : {},
                }}
              >
                <ImageIcon size={28} color={baseColors.slateLightAlpha[600]} />
                <Typography
                  sx={{ color: baseColors.slateLightAlpha[600], fontSize: 13 }}
                >
                  {modalMode === 'view' ? 'Không có ảnh' : 'Chọn hình ảnh'}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Trạng thái (chỉ hiện ở view mode) */}
          {modalMode === 'view' && draft?.status !== undefined && (
            <Box>
              <Typography
                sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
              >
                Trạng thái
              </Typography>
              <Chip
                label={statusLabels[draft.status] || 'Khác'}
                size="small"
                sx={{
                  bgcolor: (
                    statusColors[draft.status] ||
                    statusColors[UtilityMeterReadingStatus.Pending]
                  ).bg,
                  color: (
                    statusColors[draft.status] ||
                    statusColors[UtilityMeterReadingStatus.Pending]
                  ).color,
                  fontWeight: 600,
                  fontSize: 13,
                  height: 30,
                  border: `1px solid ${(statusColors[draft.status] || statusColors[UtilityMeterReadingStatus.Pending]).color}30`,
                }}
              />
            </Box>
          )}
        </Box>

        {/* Modal Footer */}
        <Box sx={{ display: 'flex', gap: 1.5, pt: 2, px: 3, pb: 3 }}>
          {modalMode !== 'view' && (
            <Box
              component="button"
              onClick={handleSave}
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                py: 1.25,
                borderRadius: 2,
                border: 'none',
                bgcolor: semanticColors.info.main,
                color: baseColors.background.default,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: semanticColors.info.light },
              }}
            >
              <Save size={16} /> Lưu thông tin
            </Box>
          )}
          <Box
            component="button"
            onClick={handleCloseModal}
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              py: 1.25,
              borderRadius: 2,
              border: 'none',
              bgcolor: baseColors.whiteAlpha[100],
              color: baseColors.text.primary,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: baseColors.whiteAlpha[200],
                color: baseColors.text.primary,
              },
            }}
          >
            {modalMode === 'view' ? 'Đóng' : 'Hủy bỏ'}
          </Box>
        </Box>
      </Dialog>
    </motion.div>
  );
};

export default UtilityMeterReadingPanel;
