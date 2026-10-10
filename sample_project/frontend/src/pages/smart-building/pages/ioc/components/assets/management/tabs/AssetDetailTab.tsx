import type { AssetDetail } from '@/services/ioc/assetDetail.service';
import { assetDetailService } from '@/services/ioc/assetDetail.service';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  Menu,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import { CurrencyInput } from '@/components/field/CurrencyInput';
import { DateInput } from '@/components/field/DateInput';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Save } from 'lucide-react';
import { useSnackbar } from 'notistack';
import ExcelJS from 'exceljs';
import { useEffect, useState } from 'react';
import { assetCategoryService } from '@/services/ioc/assetCategory.service';
import type { SystemCode } from '@/services/ioc/category.service';
import { categoryService } from '@/services/ioc/category.service';
import { SearchableSelect } from '@/components/field/SearchableSelect';
import type { SelectOption } from '@/components/field/SearchableSelect';
import { AssetLogTable } from './AssetLogTable';

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "12px 16px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  color: "#f1f5f9",
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.2s",
};

const ASSET_STATUSES = [
  { value: 1, label: 'Chưa sử dụng', color: '#9ca3af' },
  { value: 2, label: 'Đang sử dụng', color: '#10b981' },
  { value: 3, label: 'Đang sửa chữa', color: '#f59e0b' },
  { value: 4, label: 'Báo hỏng', color: '#f97316' },
  { value: 5, label: 'Đã thanh lý', color: '#ef4444' },
  { value: 6, label: 'Thất lạc', color: '#64748b' },
];

const filterSelectStyle = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '13px',
  outline: 'none',
  cursor: 'pointer',
  height: '45px',
  boxSizing: 'border-box' as const,
};

export const AssetDetailTab = () => {
  const { enqueueSnackbar } = useSnackbar();
  
  const [keyword, setKeyword] = useState('');
  const [assetCategoryId, setAssetCategoryId] = useState<number | undefined>();
  const [warehouseCategoryId, setWarehouseCategoryId] = useState<number | undefined>();
  const [status, setStatus] = useState<number | undefined>();
  const [systemCodeId, setSystemCodeId] = useState<number | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  
  const [data, setData] = useState<AssetDetail[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<AssetDetail | null>(null);

  // Form State
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [draft, setDraft] = useState<Partial<AssetDetail> | null>(null);

  // Chỉ còn cần systemCodes cho SearchableSelect trong form (chưa join từ BE)
  const [systemCodes, setSystemCodes] = useState<SystemCode[]>([]);

  useEffect(() => {
    categoryService.getSystemCodes(0, 200).then(res =>
      setSystemCodes(res.items || [])
    ).catch(console.error);
  }, []);

  // Fetch options cho SearchableSelect (server-side search, debounce trong component)
  const fetchAssetCategoryOptions = async (keyword: string): Promise<SelectOption[]> => {
    const res = await assetCategoryService.getAssetCategories(0, 50, keyword);
    return (res.items || []).filter(c => c.id).map(c => ({ value: c.id as number, label: `${c.code} - ${c.name}` }));
  };

  const fetchWarehouseOptions = async (keyword: string): Promise<SelectOption[]> => {
    const res = await categoryService.getWarehouseCategories(0, 50, keyword);
    return (res.items || []).filter(w => w.id).map(w => ({ value: w.id as number, label: w.name }));
  };

  const fetchSystemCodeOptions = async (keyword: string): Promise<SelectOption[]> => {
    const res = await categoryService.getSystemCodes(0, 50, keyword);
    const items = res.items || [];
    setSystemCodes(prev => {
      const map = new Map(prev.map(x => [x.id, x]));
      items.forEach(x => { if (x.id) map.set(x.id, x); });
      return Array.from(map.values());
    });
    return items.filter(s => s.id).map(s => ({ value: s.id as number, label: s.name }));
  };


  const [activeTab, setActiveTab] = useState(0);

  // ─── Fetch d\u1eef li\u1ec7u b\u1ea3ng ──────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await assetDetailService.getAssetDetails(
          page * rowsPerPage,
          rowsPerPage,
          keyword,
          assetCategoryId,
          warehouseCategoryId,
          status,
          systemCodeId
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
    return () => { active = false; };
  }, [page, rowsPerPage, keyword, assetCategoryId, warehouseCategoryId, status, systemCodeId, refreshTrigger]);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, row: AssetDetail) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const handleOpenAdd = () => {
    setDraft({ assetCode: '', assetName: '', assetCategoryId: 0, status: 2, assetValue: 0, warehouseCategoryId: null, systemCodeId: null, serialNumber: '', location: '', warrantyCode: '', origin: '', notes: '' });
    setModalMode('add');
    setActiveTab(0);
  };

  const handleOpenView = (item: AssetDetail) => {
    setDraft(item);
    setModalMode('view');
    setActiveTab(0);
  };

  const handleOpenEdit = (item: AssetDetail) => {
    setDraft(item);
    setModalMode('edit');
    setActiveTab(0);
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setDraft(null);
    setActiveTab(0);
  };

  const handleSave = async () => {
    if (!draft || !draft.assetName || !draft.assetCategoryId) {
      enqueueSnackbar('Vui lòng nhập đầy đủ các trường bắt buộc', { variant: 'warning' });
      return;
    }

    try {
      if (modalMode === 'edit' && draft.id) {
        await assetDetailService.updateAssetDetail(draft);
        enqueueSnackbar('Cập nhật thành công', { variant: 'success' });
      } else {
        await assetDetailService.createAssetDetail(draft);
        enqueueSnackbar('Thêm mới thành công', { variant: 'success' });
      }
      handleCloseModal();
      setRefreshTrigger(prev => prev + 1);
    } catch (_e) {
      enqueueSnackbar('Có lỗi xảy ra khi lưu dữ liệu', { variant: 'error' });
    }
  };

  const handleDelete = async (item: AssetDetail) => {
    if (confirm('Bạn có chắc chắn muốn xoá mục này?')) {
      try {
        if (item.id) await assetDetailService.deleteAssetDetail(item.id);
        enqueueSnackbar('Xoá thành công', { variant: 'success' });
        setRefreshTrigger(prev => prev + 1);
      } catch (_e) {
        enqueueSnackbar('Có lỗi xảy ra khi xoá', { variant: 'error' });
      }
    }
  };

  const getStatusLabel = (status: number) => ASSET_STATUSES.find(x => x.value === status)?.label || '';
  const getStatusColor = (status: number) => ASSET_STATUSES.find(x => x.value === status)?.color || '#9ca3af';


  const handleExportExcel = async () => {
    try {
      const res = await assetDetailService.getAssetDetails(
        0, 5000, keyword, assetCategoryId, warehouseCategoryId, status, systemCodeId
      );
      const exportData = res.items || [];
      if (exportData.length === 0) {
        enqueueSnackbar('Không có dữ liệu để xuất', { variant: 'warning' });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Tài sản chi tiết');
      const headers = ['Mã tài sản', 'Tên tài sản', 'Thuộc danh mục', 'Lưu kho', 'Số Serial', 'Trạng thái', 'Vị trí', 'Giá trị (VNĐ)'];
      
      const thinBorder: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 12 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = thinBorder;
      });

      exportData.forEach(item => {
        const row = worksheet.addRow([
          item.assetCode || '',
          item.assetName || '',
          item.assetCategoryName || '',
          item.warehouseCategoryName || '',
          item.serialNumber || '',
          getStatusLabel(item.status),
          item.location || '',
          item.assetValue || 0
        ]);
        row.eachCell(cell => { cell.border = thinBorder; cell.alignment = { vertical: 'middle' }; });
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
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TaiSanChiTiet_${new Date().getTime()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      enqueueSnackbar('Xuất file thành công', { variant: 'success' });
    } catch (_e) {
      enqueueSnackbar('Đã có lỗi xảy ra khi xuất file', { variant: 'error' });
    }
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, pt: 2, overflow: 'hidden' }}>
      
      {/* Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 1.5, flex: 1, minWidth: 300 }}>
          <TextField
            placeholder="Tìm kiếm mã, tên tài sản..."
            size="small"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            sx={{
              width: 350,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.03)',
                color: '#fff',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              }
            }}
            InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 18, mr: 1, color: '#64748b' }} /> }}
          />
          <Box
            component="button"
            onClick={() => setShowFilters(!showFilters)}
            sx={{ 
              display: 'flex', alignItems: 'center', gap: 1, px: 2, minWidth: 100, height: 40,
              borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', 
              bgcolor: showFilters ? 'rgba(0, 184, 219, 0.1)' : 'rgba(255,255,255,0.02)', 
              color: showFilters ? '#00B8DB' : '#d1d5db', cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.05)' }
            }}
          >
            <FilterAltOutlinedIcon sx={{ fontSize: 20 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>Bộ lọc</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            onClick={handleExportExcel}
            variant="outlined" startIcon={<FileDownloadOutlinedIcon />}
            sx={{ color: '#d1d5db', borderColor: 'rgba(255,255,255,0.15)', fontWeight: 500, textTransform: 'none', borderRadius: 2, px: 3, py: 1, bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.05)' } }}
          >
            Xuất Excel
          </Button>
          <Button
            onClick={handleOpenAdd}
            variant="contained" startIcon={<AddIcon />}
            sx={{ bgcolor: '#00B8DB', color: '#fff', fontWeight: 600, textTransform: 'none', borderRadius: 2, px: 3, py: 1, boxShadow: 'none', '&:hover': { bgcolor: '#0097B5', boxShadow: 'none' } }}
          >
            Thêm mới
          </Button>
        </Box>
      </Box>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: 'auto', opacity: 1, marginBottom: 24 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
          >
            <Box sx={{ 
              p: 2.5, borderRadius: 3, 
              bgcolor: 'rgba(15, 23, 42, 0.4)', 
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', gap: 2, flexWrap: 'wrap'
            }}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography sx={{ color: '#64748b', fontSize: 12, mb: 1, fontWeight: 500 }}>Danh mục</Typography>
                <SearchableSelect
                  value={assetCategoryId ?? null}
                  placeholder="Tất cả danh mục"
                  fetchOptions={fetchAssetCategoryOptions}
                  onChange={(val) => setAssetCategoryId(val ? Number(val) : undefined)}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography sx={{ color: '#64748b', fontSize: 12, mb: 1, fontWeight: 500 }}>Kho lưu trữ</Typography>
                <SearchableSelect
                  value={warehouseCategoryId ?? null}
                  placeholder="Tất cả kho"
                  fetchOptions={fetchWarehouseOptions}
                  onChange={(val) => setWarehouseCategoryId(val ? Number(val) : undefined)}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography sx={{ color: '#64748b', fontSize: 12, mb: 1, fontWeight: 500 }}>Hệ thống</Typography>
                <SearchableSelect
                  value={systemCodeId ?? null}
                  placeholder="Tất cả hệ thống"
                  fetchOptions={fetchSystemCodeOptions}
                  selectedLabel={systemCodes.find(s => s.id === systemCodeId)?.name}
                  onChange={(val) => setSystemCodeId(val ? Number(val) : undefined)}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography sx={{ color: '#64748b', fontSize: 12, mb: 1, fontWeight: 500 }}>Trạng thái</Typography>
                <select 
                  style={filterSelectStyle}
                  value={status ?? ''}
                  onChange={(e) => setStatus(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">Tất cả trạng thái</option>
                  {ASSET_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
                <Box 
                  component="button"
                  onClick={() => {
                    setAssetCategoryId(undefined);
                    setWarehouseCategoryId(undefined);
                    setStatus(undefined);
                    setSystemCodeId(undefined);
                  }}
                  sx={{ 
                    height: 38, px: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)',
                    bgcolor: 'transparent', color: '#64748b', cursor: 'pointer',
                    '&:hover': { color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }
                  }}
                >
                  Xóa lọc
                </Box>
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TABLE */}
      <TableContainer
        sx={{
          flex: 1,
          overflow: 'auto',
          border: '1px solid rgba(255,255,255,0.08)', rounded: 2,
          '&::-webkit-scrollbar': { width: '6px', height: '6px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: '8px' },
          '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,255,255,0.25)' },
        }}
      >
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ bgcolor: '#1a2332', color: '#9ca3af', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', py: 2, pl: 4 }}>MÃ TÀI SẢN</TableCell>
              <TableCell sx={{ bgcolor: '#1a2332', color: '#9ca3af', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', py: 2 }}>TÊN TÀI SẢN</TableCell>
              <TableCell sx={{ bgcolor: '#1a2332', color: '#9ca3af', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', py: 2 }}>THUỘC DANH MỤC</TableCell>
              <TableCell sx={{ bgcolor: '#1a2332', color: '#9ca3af', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', py: 2 }}>KHO LƯU TRỮ</TableCell>
              <TableCell sx={{ bgcolor: '#1a2332', color: '#9ca3af', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', py: 2 }}>TRẠNG THÁI</TableCell>
              <TableCell align="right" sx={{ bgcolor: '#1a2332', color: '#9ca3af', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', py: 2, pr: 4 }}>HÀNH ĐỘNG</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <AnimatePresence>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 8, borderBottom: 'none' }}><CircularProgress size={30} sx={{ color: '#00B8DB' }} /></TableCell></TableRow>
              ) : data.length > 0 ? (
                data.map((row, index) => (
                  <motion.tr
                    key={row.id ?? row.assetCode}
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: index * 0.05 }}
                    style={{ transition: 'background-color 0.2s' }} className="hover:bg-white/5"
                  >
                    <TableCell sx={{ color: '#00B8DB', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.04)', py: 2.5, pl: 4 }}>{row.assetCode}</TableCell>
                    <TableCell sx={{ color: '#e5e7eb', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.04)', py: 2.5 }}>{row.assetName}</TableCell>
                    <TableCell sx={{ color: '#e5e7eb', borderBottom: '1px solid rgba(255,255,255,0.04)', py: 2.5 }}>{row.assetCategoryName || ''}</TableCell>
                    <TableCell sx={{ color: '#e5e7eb', borderBottom: '1px solid rgba(255,255,255,0.04)', py: 2.5 }}>{row.warehouseCategoryName || ''}</TableCell>
                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 2.5 }}>
                      <Box sx={{ display: 'inline-block', px: 1.5, py: 0.5, borderRadius: 1, bgcolor: `${getStatusColor(row.status)}15`, color: getStatusColor(row.status), fontSize: 12, fontWeight: 600 }}>
                        {getStatusLabel(row.status)}
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 2.5, pr: 4 }}>
                      <IconButton size="small" onClick={(e) => handleOpenMenu(e, row)} sx={{ color: '#9ca3af', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                        <MoreVertIcon fontSize="small" sx={{ fontSize: 20 }} />
                      </IconButton>
                    </TableCell>
                  </motion.tr>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 8, borderBottom: 'none' }}><Typography sx={{ color: '#9ca3af' }}>Danh sách tài sản đang trống</Typography></TableCell></TableRow>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </TableContainer>

      {/* FOOTER */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>Số hàng mỗi trang:</Typography>
          <Select
            value={rowsPerPage}
            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
            size="small"
            sx={{ color: '#fff', fontSize: 13, height: 32, bgcolor: 'rgba(255,255,255,0.02)', '& .MuiSelect-icon': { color: '#9ca3af' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
          >
            <MenuItem value={10}>10</MenuItem>
            <MenuItem value={20}>20</MenuItem>
            <MenuItem value={50}>50</MenuItem>
            <MenuItem value={100}>100</MenuItem>
          </Select>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>
            {totalCount === 0 ? '0-0 trên 0' : `${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, totalCount)} trên ${totalCount}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.15)', bgcolor: 'rgba(255,255,255,0.02)', textTransform: 'none', minWidth: 'unset', px: 2, py: 0.5, '&.Mui-disabled': { color: '#6b7280', borderColor: 'rgba(255,255,255,0.05)' } }}
            >Trước</Button>
            <Button
              variant="outlined"
              disabled={(page + 1) * rowsPerPage >= totalCount}
              onClick={() => setPage(page + 1)}
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.15)', bgcolor: 'rgba(255,255,255,0.02)', textTransform: 'none', minWidth: 'unset', px: 2, py: 0.5, '&.Mui-disabled': { color: '#6b7280', borderColor: 'rgba(255,255,255,0.05)' } }}
            >Sau</Button>
          </Box>
        </Box>
      </Box>

      {/* ROW ACTION MENU */}
      <Menu
        anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}
        disableScrollLock
        PaperProps={{ sx: { bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, mt: 1, minWidth: 160, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' } }}
      >
        <MenuItem onClick={() => { handleCloseMenu(); if (selectedRow) handleOpenView(selectedRow); }} sx={{ color: '#e2e8f0', py: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
          <VisibilityOutlinedIcon sx={{ mr: 2, fontSize: 20 }} /> Xem chi tiết
        </MenuItem>
        <MenuItem onClick={() => { handleCloseMenu(); if (selectedRow) handleOpenEdit(selectedRow); }} sx={{ color: '#e2e8f0', py: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
          <EditOutlinedIcon sx={{ mr: 2, fontSize: 20 }} /> Chỉnh sửa
        </MenuItem>
        <MenuItem onClick={() => { handleCloseMenu(); if (selectedRow) handleDelete(selectedRow); }} sx={{ color: '#ef4444', py: 1.5, '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}>
          <DeleteOutlineIcon sx={{ mr: 2, fontSize: 20 }} /> Xoá mục này
        </MenuItem>
      </Menu>

      {/* MODAL THÊM / SỬA / XEM */}
      <Dialog
        open={Boolean(modalMode)} onClose={handleCloseModal} maxWidth="md" fullWidth
        PaperProps={{ 
          sx: { 
            bgcolor: '#0f172a', 
            border: '1px solid rgba(255,255,255,0.1)', 
            borderRadius: 3, 
            backgroundImage: 'none',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: '3px' },
            '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,255,255,0.25)' },
          } 
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography sx={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>
            {modalMode === 'add' ? 'Thêm mới Tài sản' : modalMode === 'edit' ? 'Chỉnh sửa Tài sản' : 'Chi tiết Tài sản'}
          </Typography>
          <Box component="button" onClick={handleCloseModal} sx={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", p: 0.5, "&:hover": { color: "#94a3b8" } }}><X size={20} /></Box>
        </Box>

        {modalMode !== 'add' && (
          <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.08)', px: 3 }}>
            <Tabs 
              value={activeTab} 
              onChange={(_, newValue) => setActiveTab(newValue)} 
              sx={{ minHeight: 40, '& .MuiTab-root': { textTransform: 'none', minHeight: 40, color: '#94a3b8', '&.Mui-selected': { color: '#00B8DB' } }, '& .MuiTabs-indicator': { backgroundColor: '#00B8DB' } }}
            >
              <Tab label="Thông tin chung" />
              <Tab label="Nhật ký tài sản" />
            </Tabs>
          </Box>
        )}

        <Box sx={{ px: 3, pb: 1, display: activeTab === 0 ? "flex" : "none", flexDirection: "column", gap: 2.5, mt: 3 }}>
          
          <Box sx={{ display: "flex", gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>
                Mã tài sản
                {modalMode === 'add' && <span style={{ color: '#64748b', fontSize: 11, marginLeft: 6 }}>(để trống = tự động sinh)</span>}
              </Typography>
              <input
                style={{
                  ...fieldStyle,
                  opacity: modalMode !== 'add' ? 0.6 : 1,
                  cursor: modalMode !== 'add' ? 'not-allowed' : 'text',
                }}
                value={draft?.assetCode ?? ""}
                readOnly={modalMode !== 'add'}
                placeholder={modalMode === 'add' ? 'Tự động sinh nếu để trống...' : ''}
                onChange={(e) => setDraft((d) => d ? { ...d, assetCode: e.target.value } : d)}
              />
            </Box>
            <Box sx={{ flex: 1.5 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Tên tài sản chi tiết {modalMode !== 'view' && <span style={{color: "#ef4444"}}>*</span>}</Typography>
              <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.6 : 1, cursor: modalMode === 'view' ? 'not-allowed' : 'text' }} value={draft?.assetName ?? ""} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, assetName: e.target.value } : d)} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Trạng thái</Typography>
              <select disabled={modalMode === 'view'} style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.6 : 1, cursor: modalMode === 'view' ? 'not-allowed' : 'pointer' }} value={draft?.status ?? 2} onChange={(e) => setDraft((d) => d ? { ...d, status: Number(e.target.value) } : d)}>
                {ASSET_STATUSES.map(s => <option key={s.value} value={s.value} style={{ background: '#0d1b2e' }}>{s.label}</option>)}
              </select>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Thuộc danh mục {modalMode !== 'view' && <span style={{color: "#ef4444"}}>*</span>}</Typography>
              <SearchableSelect
                value={draft?.assetCategoryId || null}
                placeholder="-- Chọn danh mục tài sản --"
                disabled={modalMode === 'view'}
                fetchOptions={fetchAssetCategoryOptions}
                selectedLabel={draft?.assetCategoryName}
                onChange={(val) => setDraft((d) => d ? { ...d, assetCategoryId: val ? Number(val) : 0, assetCategoryName: undefined } : d)}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Kho lưu trữ</Typography>
              <SearchableSelect
                value={draft?.warehouseCategoryId ?? null}
                placeholder="-- Chọn kho... --"
                disabled={modalMode === 'view'}
                fetchOptions={fetchWarehouseOptions}
                selectedLabel={draft?.warehouseCategoryName}
                onChange={(val) => setDraft((d) => d ? { ...d, warehouseCategoryId: val ? Number(val) : null, warehouseCategoryName: undefined } : d)}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Hệ thống (System Code)</Typography>
              <SearchableSelect
                value={draft?.systemCodeId ?? null}
                placeholder="-- Chọn hệ thống... --"
                disabled={modalMode === 'view'}
                fetchOptions={fetchSystemCodeOptions}
                selectedLabel={systemCodes.find(s => s.id === draft?.systemCodeId)?.name}
                onChange={(val) => setDraft((d) => d ? { ...d, systemCodeId: val ? Number(val) : null } : d)}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Số Serial</Typography>
              <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.6 : 1, cursor: modalMode === 'view' ? 'not-allowed' : 'text' }} value={draft?.serialNumber ?? ""} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, serialNumber: e.target.value } : d)} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Mã bảo hành</Typography>
              <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.6 : 1, cursor: modalMode === 'view' ? 'not-allowed' : 'text' }} value={draft?.warrantyCode ?? ""} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, warrantyCode: e.target.value } : d)} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Giá trị (VNĐ)</Typography>
              <CurrencyInput
                value={draft?.assetValue ?? 0}
                readOnly={modalMode === 'view'}
                onChange={(val) => setDraft((d) => d ? { ...d, assetValue: val } : d)}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Ngày đưa vào sử dụng</Typography>
              <DateInput
                style={fieldStyle}
                value={draft?.usageDate}
                readOnly={modalMode === 'view'}
                onChange={(val) => setDraft((d) => d ? { ...d, usageDate: val } : d)}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Ngày bắt đầu bảo hành/khấu hao</Typography>
              <DateInput
                style={fieldStyle}
                value={draft?.startDate}
                readOnly={modalMode === 'view'}
                onChange={(val) => setDraft((d) => d ? { ...d, startDate: val } : d)}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Ngày hết bảo hành/khấu hao</Typography>
              <DateInput
                style={fieldStyle}
                value={draft?.endDate}
                readOnly={modalMode === 'view'}
                onChange={(val) => setDraft((d) => d ? { ...d, endDate: val } : d)}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Vị trí / Phòng ban</Typography>
              <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.6 : 1, cursor: modalMode === 'view' ? 'not-allowed' : 'text' }} value={draft?.location ?? ""} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, location: e.target.value } : d)} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Xuất xứ</Typography>
              <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.6 : 1, cursor: modalMode === 'view' ? 'not-allowed' : 'text' }} value={draft?.origin ?? ""} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, origin: e.target.value } : d)} />
            </Box>
          </Box>

          <Box>
            <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Ghi chú</Typography>
            <textarea style={{ ...fieldStyle, minHeight: '80px', resize: 'vertical', opacity: modalMode === 'view' ? 0.6 : 1, cursor: modalMode === 'view' ? 'not-allowed' : 'text' }} value={draft?.notes ?? ""} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, notes: e.target.value } : d)} />
          </Box>

          <Box sx={{ pb: 3 }} />

        </Box>

        {activeTab === 1 && modalMode !== 'add' && draft?.id && (
          <Box sx={{ display: "flex", flexDirection: "column", minHeight: 400 }}>
            <AssetLogTable assetDetailId={draft.id} />
          </Box>
        )}

        {modalMode !== 'view' && activeTab === 0 && (
          <Box sx={{ p: 3, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button onClick={handleCloseModal} sx={{ color: '#94a3b8', textTransform: 'none', fontWeight: 500, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>Huỷ bỏ</Button>
            <Button onClick={handleSave} variant="contained" startIcon={<Save size={18} />} sx={{ bgcolor: '#00B8DB', color: '#fff', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#0097B5', boxShadow: 'none' } }}>Lưu dữ liệu</Button>
          </Box>
        )}
      </Dialog>
    </Box>
  );
};
