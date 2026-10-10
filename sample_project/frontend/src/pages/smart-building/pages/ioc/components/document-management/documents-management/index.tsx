import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
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
import { Save, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useEffect, useRef, useState } from 'react';

import { httpService } from '@/base/http-service';
import {
  type DocumentType,
  Scope,
  documentTypeService,
} from '@/services/ioc/document-management/document-type.service';
import {
  type Document,
  documentService,
} from '@/services/ioc/document-management/document.service';
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

const scopeLabels: Record<number, string> = {
  [Scope.Web]: 'Web',
  [Scope.MobileApp]: 'Mobile App',
  [Scope.All]: 'Tất cả',
};

const scopeColors: Record<number, { bg: string; color: string }> = {
  [Scope.All]: {
    bg: semanticColors.warning.background,
    color: semanticColors.warning.text,
  },
  [Scope.MobileApp]: {
    bg: semanticColors.success.background,
    color: semanticColors.success.text,
  },
  [Scope.Web]: {
    bg: semanticColors.info.background,
    color: semanticColors.info.main,
  },
};

const formatDateTimeVN = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const DocumentPanel = () => {
  const { enqueueSnackbar } = useSnackbar();

  const [data, setData] = useState<Document[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // File upload state
  const fileUploadRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fileUploadRef.current = file;
    setDraft((d) => (d ? { ...d, fileUrl: '' } : d));
  };

  const handleRemoveFile = () => {
    fileUploadRef.current = null;
    setDraft((d) => (d ? { ...d, fileUrl: '' } : d));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // DocumentType list for dropdown
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);

  // Filter state
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(
    null,
  );
  const [scopeFilter, setScopeFilter] = useState<Scope | ''>('');
  const [documentTypeIdFilter, setDocumentTypeIdFilter] = useState<number | ''>(
    '',
  );
  const [pendingScopeFilter, setPendingScopeFilter] = useState<Scope | ''>('');
  const [pendingDocumentTypeIdFilter, setPendingDocumentTypeIdFilter] =
    useState<number | ''>('');

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<Document | null>(null);

  // Modal state
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(
    null,
  );
  const [draft, setDraft] = useState<Partial<Document> | null>(null);

  // Fetch document types for dropdown
  useEffect(() => {
    const fetchDocumentTypes = async () => {
      try {
        const res = await documentTypeService.getDocumentTypes(0, 5000);
        setDocumentTypes(res.items || []);
      } catch (err) {
        console.error('Failed to fetch document types:', err);
      }
    };
    fetchDocumentTypes();
  }, []);

  // Fetch data
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await documentService.getDocuments(
          page * rowsPerPage,
          rowsPerPage,
          search,
          scopeFilter !== '' ? scopeFilter : undefined,
          documentTypeIdFilter !== '' ? documentTypeIdFilter : undefined,
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
    scopeFilter,
    documentTypeIdFilter,
    refreshTrigger,
  ]);

  // Filter handlers
  const handleOpenFilter = (event: React.MouseEvent<HTMLElement>) => {
    setPendingScopeFilter(scopeFilter);
    setPendingDocumentTypeIdFilter(documentTypeIdFilter);
    setFilterAnchorEl(event.currentTarget);
  };

  const handleCloseFilter = () => setFilterAnchorEl(null);

  const handleApplyFilter = () => {
    setScopeFilter(pendingScopeFilter);
    setDocumentTypeIdFilter(pendingDocumentTypeIdFilter);
    setPage(0);
    handleCloseFilter();
  };

  const handleResetFilter = () => {
    setPendingScopeFilter('');
    setPendingDocumentTypeIdFilter('');
    setScopeFilter('');
    setDocumentTypeIdFilter('');
    setPage(0);
    handleCloseFilter();
  };

  // Menu handlers
  const handleOpenMenu = (
    event: React.MouseEvent<HTMLElement>,
    row: Document,
  ) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const handleOpenAdd = () => {
    setDraft({
      code: '',
      name: '',
      documentTypeId: 0,
      fileUrl: '',
      linkUrl: '',
      // buildingId: 0,
    });
    fileUploadRef.current = null;
    setModalMode('add');
  };

  const handleOpenView = (item: Document) => {
    setDraft(item);
    fileUploadRef.current = null;
    setModalMode('view');
  };

  const handleOpenEdit = (item: Document) => {
    setDraft(item);
    fileUploadRef.current = null;
    setModalMode('edit');
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setDraft(null);
    fileUploadRef.current = null;
  };

  const handleSave = async () => {
    if (!draft?.code) {
      enqueueSnackbar('Vui lòng nhập mã tài liệu', { variant: 'warning' });
      return;
    }
    if (!draft?.name) {
      enqueueSnackbar('Vui lòng nhập tên tài liệu', { variant: 'warning' });
      return;
    }
    if (!draft?.documentTypeId) {
      enqueueSnackbar('Vui lòng chọn loại tài liệu', { variant: 'warning' });
      return;
    }
    if (!fileUploadRef.current && !draft?.fileUrl) {
      enqueueSnackbar('Vui lòng chọn file tài liệu', { variant: 'warning' });
      return;
    }

    try {
      let fileUrl = draft.fileUrl ?? '';

      if (fileUploadRef.current) {
        const uploadResult = await httpService.uploadBatchMinIoCms({
          files: [fileUploadRef.current],
        });
        fileUrl = uploadResult?.result?.[0] ?? fileUrl;
      }

      const payload = { ...draft, fileUrl };

      if (modalMode === 'add') {
        await documentService.createDocument(payload);
        enqueueSnackbar('Thêm mới thành công', { variant: 'success' });
      } else if (modalMode === 'edit') {
        await documentService.updateDocument(payload);
        enqueueSnackbar('Cập nhật thành công', { variant: 'success' });
      }
      handleCloseModal();
      setRefreshTrigger((prev) => prev + 1);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error?.message ||
        (e instanceof Error ? e.message : 'Có lỗi xảy ra');
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const handleDelete = async (item: Document) => {
    if (confirm('Bạn có chắc chắn muốn xoá mục này?')) {
      try {
        if (item.id) await documentService.deleteDocument(item.id);
        enqueueSnackbar('Xoá thành công', { variant: 'success' });
        setRefreshTrigger((prev) => prev + 1);
      } catch (_e) {
        enqueueSnackbar('Có lỗi xảy ra khi xoá', { variant: 'error' });
      }
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await documentService.getDocuments(0, 5000, search);
      const exportData = res.items || [];

      if (exportData.length === 0) {
        enqueueSnackbar('Không có dữ liệu để xuất', { variant: 'warning' });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Quản lý Tài liệu');

      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      const headers = [
        'STT',
        'Mã tài liệu',
        'Tên tài liệu',
        'Loại tài liệu',
        'Phạm vi',
        'Tệp đính kèm',
        'Đường dẫn',
        'Thời gian tạo',
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
          item.code || '',
          item.name || '',
          item.documentTypeName || '',
          scopeLabels[item.scope ?? 0] || '',
          item.fileUrl || '',
          item.linkUrl || '',
          formatDateTimeVN(item.createdDate),
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
        `DanhSach_TaiLieu_${new Date().getTime()}.xlsx`,
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
    return `${action} Tài liệu`;
  };

  const selectedDocType = documentTypes.find(
    (dt) => dt.id === draft?.documentTypeId,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        width: 'calc(100% - 320px)',
        height: 'calc(100vh - 160px)',
        left: 300,
        top: 80,
        zIndex: 20,
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
          Quản lý Tài liệu
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

        {/* ── Filter Popover ── */}
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
              minWidth: 480,
              overflow: 'visible',
            },
          }}
        >
          <Box sx={{ p: 2.5 }}>
            {/* Popover header */}
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

            {/* ── Phạm vi + Loại tài liệu ── */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Phạm vi */}
              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    color: baseColors.text.secondary,
                    fontSize: 12,
                    mb: 1,
                    fontWeight: 500,
                  }}
                >
                  Phạm vi
                </Typography>
                <Select
                  fullWidth
                  displayEmpty
                  size="small"
                  value={pendingScopeFilter}
                  onChange={(e) =>
                    setPendingScopeFilter(e.target.value as Scope | '')
                  }
                  renderValue={(value) =>
                    !value ? (
                      <Typography
                        sx={{ color: baseColors.text.secondary, fontSize: 14 }}
                      >
                        Chọn phạm vi
                      </Typography>
                    ) : (
                      <Typography
                        sx={{ color: semanticColors.info.text, fontSize: 14 }}
                      >
                        {scopeLabels[value as Scope]}
                      </Typography>
                    )
                  }
                  endAdornment={
                    pendingScopeFilter !== '' ? (
                      <InputAdornment position="end" sx={{ mr: 2 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingScopeFilter('');
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
                      pendingScopeFilter !== ''
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
                  <MenuItem value={Scope.Web}>Web</MenuItem>
                  <MenuItem value={Scope.MobileApp}>Mobile App</MenuItem>
                  <MenuItem value={Scope.All}>Tất cả</MenuItem>
                </Select>
              </Box>

              {/* Loại tài liệu */}
              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    color: baseColors.text.secondary,
                    fontSize: 12,
                    mb: 1,
                    fontWeight: 500,
                  }}
                >
                  Loại tài liệu
                </Typography>
                <Select
                  fullWidth
                  displayEmpty
                  size="small"
                  value={pendingDocumentTypeIdFilter}
                  onChange={(e) =>
                    setPendingDocumentTypeIdFilter(
                      e.target.value as number | '',
                    )
                  }
                  renderValue={(value) =>
                    !value ? (
                      <Typography
                        sx={{ color: baseColors.text.secondary, fontSize: 14 }}
                      >
                        Chọn loại
                      </Typography>
                    ) : (
                      <Typography
                        sx={{ color: semanticColors.info.text, fontSize: 14 }}
                      >
                        {documentTypes.find((dt) => dt.id === value)?.name ??
                          ''}
                      </Typography>
                    )
                  }
                  endAdornment={
                    pendingDocumentTypeIdFilter !== '' ? (
                      <InputAdornment position="end" sx={{ mr: 2 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDocumentTypeIdFilter('');
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
                      pendingDocumentTypeIdFilter !== ''
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
                  {documentTypes.map((dt) => (
                    <MenuItem key={dt.id} value={dt.id}>
                      {dt.name}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </Box>

            {/* ── Action buttons ── */}
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
                  { label: 'STT', align: 'left' as const, pl: 4, width: 70 },
                  { label: 'MÃ TÀI LIỆU', align: 'left' as const },
                  { label: 'TÊN TÀI LIỆU', align: 'left' as const },
                  { label: 'LOẠI TÀI LIỆU', align: 'left' as const },
                  { label: 'PHẠM VI', align: 'left' as const },
                  { label: 'TỆP ĐÍNH KÈM', align: 'left' as const },
                  { label: 'ĐƯỜNG DẪN', align: 'left' as const },
                  { label: 'THỜI GIAN TẠO', align: 'left' as const },
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
                      colSpan={8}
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
                    const scopeStyle = scopeColors[row.scope ?? 0] ?? {
                      bg: baseColors.whiteAlpha[100],
                      color: baseColors.text.secondary,
                    };
                    return (
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
                            color: semanticColors.info.main,
                            fontWeight: 500,
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                          }}
                        >
                          {row.code}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: semanticColors.info.text,
                            fontWeight: 500,
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                            maxWidth: 200,
                          }}
                        >
                          <Typography
                            noWrap
                            sx={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: semanticColors.info.text,
                            }}
                          >
                            {row.name}
                          </Typography>
                        </TableCell>
                        <TableCell
                          sx={{
                            color: semanticColors.info.text,
                            fontWeight: 500,
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                          }}
                        >
                          {row.documentTypeName || '—'}
                        </TableCell>
                        <TableCell
                          sx={{
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                          }}
                        >
                          {row.scope != null ? (
                            <Chip
                              label={scopeLabels[row.scope] || 'Khác'}
                              size="small"
                              sx={{
                                bgcolor: scopeStyle.bg,
                                color: scopeStyle.color,
                                border: `1px solid ${scopeStyle.color}30`,
                                fontWeight: 600,
                                fontSize: 12,
                                height: 26,
                                minWidth: 90,
                              }}
                            />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell
                          sx={{
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                          }}
                        >
                          {row.fileUrl ? (
                            <Typography
                              component="a"
                              href={row.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                fontSize: 13,
                                color: semanticColors.info.main,
                                textDecoration: 'none',
                                maxWidth: 160,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                            >
                              {row.fileUrl}
                            </Typography>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell
                          sx={{
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                            maxWidth: 200,
                          }}
                        >
                          {row.linkUrl ? (
                            <Typography
                              component="a"
                              href={row.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                fontSize: 13,
                                color: semanticColors.info.main,
                                textDecoration: 'none',
                                maxWidth: 160,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                            >
                              {row.linkUrl}
                            </Typography>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: semanticColors.info.text,
                            fontWeight: 500,
                            borderBottom: `1px solid ${baseColors.whiteAlpha[50]}`,
                            py: 2.5,
                            fontSize: 13,
                          }}
                        >
                          {formatDateTimeVN(row.createdDate)}
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
                      colSpan={8}
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
        <MenuItem
          onClick={() => {
            handleCloseMenu();
            if (selectedRow?.fileUrl) {
              fetch(selectedRow.fileUrl)
                .then((res) => res.blob())
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = selectedRow.name || 'file';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                })
                .catch(() => {
                  // Fallback: nếu CORS chặn fetch thì mở tab mới
                  window.open(selectedRow.fileUrl, '_blank');
                  enqueueSnackbar(
                    'Không thể tải trực tiếp, đã mở trong tab mới',
                    { variant: 'info' },
                  );
                });
            } else {
              enqueueSnackbar('Không có file để tải về', {
                variant: 'warning',
              });
            }
          }}
        >
          <FileDownloadOutlinedIcon
            fontSize="small"
            sx={{ mr: 1.5, color: semanticColors.info.text }}
          />
          Tải về
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
          {/* Mã tài liệu */}
          <Box>
            <Typography
              sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
            >
              Mã tài liệu
              {modalMode !== 'view' && (
                <span style={{ color: semanticColors.error.main }}> *</span>
              )}
            </Typography>
            <input
              style={{
                ...fieldStyle,
                border:
                  !draft?.code && modalMode !== 'view'
                    ? `1px solid ${semanticColors.error.main}80`
                    : `1px solid ${baseColors.whiteAlpha[100]}`,
                opacity: modalMode === 'view' ? 0.7 : 1,
              }}
              value={draft?.code ?? ''}
              readOnly={modalMode === 'view'}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, code: e.target.value } : d))
              }
              onFocus={(e) => {
                if (modalMode !== 'view')
                  e.target.style.borderColor = semanticColors.info.main;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = !draft?.code
                  ? `${semanticColors.error.main}80`
                  : baseColors.whiteAlpha[100];
              }}
            />
          </Box>

          {/* Tên tài liệu */}
          <Box>
            <Typography
              sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
            >
              Tên tài liệu
              {modalMode !== 'view' && (
                <span style={{ color: semanticColors.error.main }}> *</span>
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

          {/* Loại tài liệu */}
          <Box>
            <Typography
              sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
            >
              Loại tài liệu
              {modalMode !== 'view' && (
                <span style={{ color: semanticColors.error.main }}> *</span>
              )}
            </Typography>
            {modalMode === 'view' ? (
              <input
                style={{ ...fieldStyle, opacity: 0.7 }}
                value={selectedDocType?.name ?? draft?.documentTypeName ?? ''}
                readOnly
              />
            ) : (
              <select
                style={{ ...fieldStyle, cursor: 'pointer' }}
                value={draft?.documentTypeId ?? ''}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, documentTypeId: Number(e.target.value) } : d,
                  )
                }
                onFocus={(e) => {
                  e.target.style.borderColor = semanticColors.info.main;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = baseColors.whiteAlpha[100];
                }}
              >
                <option
                  value=""
                  style={{ background: baseColors.background.default }}
                >
                  -- Chọn loại tài liệu --
                </option>
                {documentTypes.map((dt) => (
                  <option
                    key={dt.id}
                    value={dt.id}
                    style={{ background: baseColors.background.default }}
                  >
                    {dt.name}
                  </option>
                ))}
              </select>
            )}
          </Box>

          {/* File URL */}
          <Box>
            <Typography
              sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
            >
              File tài liệu
              {modalMode !== 'view' && (
                <span style={{ color: semanticColors.error.main }}> *</span>
              )}
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            {modalMode === 'view' ? (
              // View mode: chỉ hiện link
              draft?.fileUrl ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InsertDriveFileOutlinedIcon
                    sx={{ fontSize: 16, color: semanticColors.info.main }}
                  />
                  <Typography
                    component="a"
                    title={draft.fileUrl}
                    href={draft.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      fontSize: 13,
                      color: semanticColors.info.main,
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {draft.fileUrl}
                  </Typography>
                </Box>
              ) : (
                <Typography
                  sx={{ color: baseColors.text.secondary, fontSize: 13 }}
                >
                  Không có file
                </Typography>
              )
            ) : fileUploadRef.current || draft?.fileUrl ? (
              // Đã chọn file hoặc đã có file
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  border: `1px solid ${baseColors.whiteAlpha[100]}`,
                  borderRadius: 2,
                  bgcolor: baseColors.whiteAlpha[50],
                }}
              >
                <InsertDriveFileOutlinedIcon
                  sx={{
                    fontSize: 20,
                    color: semanticColors.info.main,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  sx={{
                    flex: 1,
                    fontSize: 13,
                    color: semanticColors.info.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fileUploadRef.current?.name || draft?.fileUrl}
                </Typography>
                {draft?.fileUrl && !fileUploadRef.current && (
                  <Box
                    component="a"
                    href={draft.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      color: semanticColors.info.main,
                      display: 'flex',
                      flexShrink: 0,
                    }}
                  ></Box>
                )}
                <Box
                  component="button"
                  onClick={handleRemoveFile}
                  sx={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: semanticColors.error.main,
                    display: 'flex',
                    p: 0,
                    flexShrink: 0,
                    '&:hover': { color: semanticColors.error.text },
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </Box>
              </Box>
            ) : (
              // Chưa chọn file
              <Box
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  py: 3,
                  border: `2px dashed ${
                    !draft?.fileUrl && !fileUploadRef.current
                      ? `${semanticColors.error.main}80`
                      : baseColors.whiteAlpha[100]
                  }`,
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: baseColors.cyanAlpha[400],
                    bgcolor: baseColors.cyanAlpha[100],
                  },
                }}
              >
                <InsertDriveFileOutlinedIcon
                  sx={{ fontSize: 28, color: baseColors.slateLightAlpha[600] }}
                />
                <Typography
                  sx={{ color: baseColors.slateLightAlpha[600], fontSize: 13 }}
                >
                  Chọn file tài liệu
                </Typography>
              </Box>
            )}
          </Box>

          {/* Link URL */}
          <Box>
            <Typography
              sx={{ color: baseColors.text.secondary, fontSize: 13, mb: 1 }}
            >
              Đường dẫn liên kết
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <input
                style={{
                  ...fieldStyle,
                  opacity: modalMode === 'view' ? 0.7 : 1,
                  flex: 1,
                }}
                value={draft?.linkUrl ?? ''}
                readOnly={modalMode === 'view'}
                placeholder="https://..."
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, linkUrl: e.target.value } : d))
                }
                onFocus={(e) => {
                  if (modalMode !== 'view')
                    e.target.style.borderColor = semanticColors.info.main;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = baseColors.whiteAlpha[100];
                }}
              />
              {draft?.linkUrl && (
                <Box
                  component="a"
                  href={draft.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    color: semanticColors.info.main,
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <LinkOutlinedIcon sx={{ fontSize: 20 }} />
                </Box>
              )}
            </Box>
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

export default DocumentPanel;
