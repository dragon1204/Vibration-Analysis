import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Box,
  Button,
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
import { Save, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';

import {
  InvoiceMeterType,
  type MeterType,
  meterTypeService,
} from '@/services/ioc/meter-management/meter-type.service';
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

const invoiceTypeLabels: Record<number, string> = {
  [InvoiceMeterType.Electric]: 'Phí điện',
  [InvoiceMeterType.Water]: 'Phí nước',
  [InvoiceMeterType.Parking]: 'Phí đỗ xe',
  [InvoiceMeterType.Management]: 'Phí quản lý',
  [InvoiceMeterType.Other]: 'Phí khác',
};

const MeterTypePanel = () => {
  const { enqueueSnackbar } = useSnackbar();

  const [data, setData] = useState<MeterType[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filter state
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(
    null,
  );
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<
    InvoiceMeterType | ''
  >('');
  const [pendingInvoiceTypeFilter, setPendingInvoiceTypeFilter] = useState<
    InvoiceMeterType | ''
  >('');

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<MeterType | null>(null);

  // Modal state
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(
    null,
  );
  const [draft, setDraft] = useState<Partial<MeterType> | null>(null);

  // Fetch data
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await meterTypeService.getMeterTypes(
          page * rowsPerPage,
          rowsPerPage,
          search,
          invoiceTypeFilter !== '' ? invoiceTypeFilter : undefined,
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
  }, [page, rowsPerPage, search, refreshTrigger, invoiceTypeFilter]);

  // Filter handlers
  const handleOpenFilter = (event: React.MouseEvent<HTMLElement>) => {
    setPendingInvoiceTypeFilter(invoiceTypeFilter);
    setFilterAnchorEl(event.currentTarget);
  };

  const handleCloseFilter = () => {
    setFilterAnchorEl(null);
  };

  const handleApplyFilter = () => {
    setInvoiceTypeFilter(pendingInvoiceTypeFilter);
    setPage(0);
    handleCloseFilter();
  };

  const handleResetFilter = () => {
    setPendingInvoiceTypeFilter('');
    setInvoiceTypeFilter('');
    setPage(0);
    handleCloseFilter();
  };

  // Menu handlers
  const handleOpenMenu = (
    event: React.MouseEvent<HTMLElement>,
    row: MeterType,
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
    setDraft({
      name: '',
      invoiceType: InvoiceMeterType.Electric,
      description: '',
      // buildingId: 0,
    });
    setModalMode('add');
  };

  const handleOpenView = (item: MeterType) => {
    setDraft(item);
    setModalMode('view');
  };

  const handleOpenEdit = (item: MeterType) => {
    setDraft(item);
    setModalMode('edit');
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setDraft(null);
  };

  const handleSave = async () => {
    if (!draft || !draft.name) {
      enqueueSnackbar('Vui lòng nhập tên loại đồng hồ', { variant: 'warning' });
      return;
    }

    try {
      if (modalMode === 'add') {
        await meterTypeService.createMeterType(draft);
        enqueueSnackbar('Thêm mới thành công', { variant: 'success' });
      } else if (modalMode === 'edit') {
        await meterTypeService.updateMeterType(draft);
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

  const handleDelete = async (item: MeterType) => {
    if (confirm('Bạn có chắc chắn muốn xoá mục này?')) {
      try {
        if (item.id) await meterTypeService.deleteMeterType(item.id);
        enqueueSnackbar('Xoá thành công', { variant: 'success' });
        setRefreshTrigger((prev) => prev + 1);
      } catch (_e) {
        enqueueSnackbar('Có lỗi xảy ra khi xoá', { variant: 'error' });
      }
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await meterTypeService.getMeterTypes(0, 5000, search);
      const exportData = res.items || [];

      if (exportData.length === 0) {
        enqueueSnackbar('Không có dữ liệu để xuất', { variant: 'warning' });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Loại đồng hồ');

      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      const headers = ['STT', 'Tên loại đồng hồ', 'Loại hoá đơn', 'Mô tả'];
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
          item.name || '',
          invoiceTypeLabels[item.invoiceType] || '',
          item.description || '',
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
        `DanhSach_LoaiDongHo_${new Date().getTime()}.xlsx`,
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
    return `${action} Loại đồng hồ`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        height: '100%',
        width: '100%',
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
          Loại Đồng hồ
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
            minWidth: 240,
            overflow: 'visible',
          },
        }}
      >
        <Box sx={{ p: 2.5 }}>
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

          <Box>
            <Typography
              sx={{
                color: baseColors.text.secondary,
                fontSize: 12,
                mb: 1,
                fontWeight: 500,
              }}
            >
              Loại hoá đơn
            </Typography>
            <Select
              fullWidth
              displayEmpty
              renderValue={(value) =>
                !value ? (
                  <Typography
                    sx={{ color: baseColors.text.secondary, fontSize: 14 }}
                  >
                    Chọn loại hoá đơn
                  </Typography>
                ) : (
                  <Typography
                    sx={{ color: semanticColors.info.text, fontSize: 14 }}
                  >
                    {invoiceTypeLabels[value as InvoiceMeterType]}
                  </Typography>
                )
              }
              size="small"
              value={pendingInvoiceTypeFilter}
              onChange={(e) =>
                setPendingInvoiceTypeFilter(
                  e.target.value as InvoiceMeterType | '',
                )
              }
              endAdornment={
                pendingInvoiceTypeFilter !== '' ? (
                  <InputAdornment position="end" sx={{ mr: 2 }}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingInvoiceTypeFilter('');
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
                  pendingInvoiceTypeFilter !== ''
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
                        '&:hover': { bgcolor: semanticColors.info.background },
                      },
                    },
                  },
                },
              }}
            >
              {Object.entries(invoiceTypeLabels).map(([value, label]) => (
                <MenuItem key={value} value={Number(value)}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </Box>

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
                  { label: 'LOẠI ĐỒNG HỒ', align: 'left' as const },
                  { label: 'LOẠI HOÁ ĐƠN', align: 'left' as const },
                  { label: 'MÔ TẢ', align: 'left' as const },
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
                      colSpan={5}
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
                  data.map((row, index) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: index * 0.05 }}
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
                          color: semanticColors.info.text,
                          fontWeight: 500,
                          borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                          py: 2.5,
                        }}
                      >
                        {row.name}
                      </TableCell>
                      <TableCell
                        sx={{
                          color: semanticColors.info.text,
                          fontWeight: 500,
                          borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                          py: 2.5,
                        }}
                      >
                        {invoiceTypeLabels[row.invoiceType] || row.invoiceType}
                      </TableCell>
                      <TableCell
                        sx={{
                          color: semanticColors.info.text,
                          fontWeight: 500,
                          borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                          py: 2.5,
                        }}
                      >
                        {row.description || '—'}
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
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
              {(['Trước', 'Sau'] as const).map((label) => (
                <Button
                  key={label}
                  variant="outlined"
                  disabled={
                    label === 'Trước'
                      ? page === 0
                      : (page + 1) * rowsPerPage >= totalCount
                  }
                  onClick={() =>
                    setPage(label === 'Trước' ? page - 1 : page + 1)
                  }
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
                  {label}
                </Button>
              ))}
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
            minWidth: 120,
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
          <DeleteOutlineIcon
            fontSize="small"
            sx={{ mr: 1.5, color: semanticColors.error.text }}
          />
          Xóa
        </MenuItem>
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
          {/* Tên loại đồng hồ */}
          <Box>
            <Typography
              sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
            >
              Tên loại đồng hồ{' '}
              {modalMode !== 'view' && (
                <span style={{ color: semanticColors.error.main }}>*</span>
              )}
            </Typography>
            <input
              style={{
                ...fieldStyle,
                border:
                  !draft?.name && modalMode !== 'view'
                    ? `1px solid ${semanticColors.error.main}80`
                    : `1px solid ${baseColors.whiteAlpha[100]}`,
                opacity: modalMode === 'view' ? 0.7 : 1,
              }}
              value={draft?.name ?? ''}
              readOnly={modalMode === 'view'}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, name: e.target.value } : d))
              }
              onFocus={(e) => {
                if (modalMode !== 'view')
                  e.target.style.borderColor = semanticColors.info.main;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = !draft?.name
                  ? `${semanticColors.error.main}80`
                  : baseColors.whiteAlpha[100];
              }}
            />
          </Box>

          {/* Loại hoá đơn */}
          <Box>
            <Typography
              sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
            >
              Loại hoá đơn{' '}
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
              value={draft?.invoiceType ?? InvoiceMeterType.Electric}
              onChange={(e) =>
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        invoiceType: Number(e.target.value) as InvoiceMeterType,
                      }
                    : d,
                )
              }
            >
              <option
                value={InvoiceMeterType.Electric}
                style={{ background: baseColors.background.default }}
              >
                Phí điện
              </option>
              <option
                value={InvoiceMeterType.Water}
                style={{ background: baseColors.background.default }}
              >
                Phí nước
              </option>
              <option
                value={InvoiceMeterType.Parking}
                style={{ background: baseColors.background.default }}
              >
                Phí đỗ xe
              </option>
              <option
                value={InvoiceMeterType.Management}
                style={{ background: baseColors.background.default }}
              >
                Phí quản lý
              </option>
              <option
                value={InvoiceMeterType.Other}
                style={{ background: baseColors.background.default }}
              >
                Phí khác
              </option>
            </select>
          </Box>

          {/* Mô tả */}
          <Box>
            <Typography
              sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
            >
              Mô tả
            </Typography>
            <textarea
              style={{
                ...fieldStyle,
                minHeight: '80px',
                resize: 'vertical',
                opacity: modalMode === 'view' ? 0.7 : 1,
              }}
              value={draft?.description ?? ''}
              readOnly={modalMode === 'view'}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, description: e.target.value } : d))
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

export default MeterTypePanel;
