import type { AssetCategory } from '@/services/ioc/assetCategory.service';
import { assetCategoryService } from '@/services/ioc/assetCategory.service';
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
  Tabs,
  Tab,
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
  TextField,
  Typography,
} from '@mui/material';
import { CurrencyInput } from '@/components/field/CurrencyInput';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Save, ImageIcon } from 'lucide-react';
import { useSnackbar } from 'notistack';
import ExcelJS from 'exceljs';
import { useEffect, useState, useRef } from 'react';
import type { AssetGroup, AssetType, AssetUnit, AssetManufacturer } from '@/services/ioc/category.service';
import { categoryService } from '@/services/ioc/category.service';

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

const formatVND = (val: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
};

export const AssetListTab = () => {
  const { enqueueSnackbar } = useSnackbar();
  
  const [keyword, setKeyword] = useState('');
  const [assetGroupId, setAssetGroupId] = useState<number | undefined>();
  const [assetTypeId, setAssetTypeId] = useState<number | undefined>();
  const [unitId, setUnitId] = useState<number | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  
  const [data, setData] = useState<AssetCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<AssetCategory | null>(null);

  // Form State
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [draft, setDraft] = useState<Partial<AssetCategory> | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stockCardData, setStockCardData] = useState<any[]>([]);
  const [loadingStockCard, setLoadingStockCard] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // References
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [assetUnits, setAssetUnits] = useState<AssetUnit[]>([]);
  const [manufacturers, setManufacturers] = useState<AssetManufacturer[]>([]);

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        setDraft(d => d ? { ...d, imageUrls: [...(d.imageUrls || []), url] } : d);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setDraft(d => {
      if (!d) return d;
      const newUrls = [...(d.imageUrls || [])];
      newUrls.splice(index, 1);
      return { ...d, imageUrls: newUrls };
    });
  };

  useEffect(() => {
    categoryService.getAssetGroups(0, 5000).then(res => setAssetGroups(res.items || [])).catch(console.error);
    categoryService.getAssetTypes(0, 5000).then(res => setAssetTypes(res.items || [])).catch(console.error);
    categoryService.getAssetUnits(0, 5000).then(res => setAssetUnits(res.items || [])).catch(console.error);
    categoryService.getAssetManufacturers(0, 5000).then(res => setManufacturers(res.items || [])).catch(console.error);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await assetCategoryService.getAssetCategories(
          page * rowsPerPage, 
          rowsPerPage, 
          keyword,
          assetGroupId,
          assetTypeId,
          unitId
        );
        if (active) {
          setData(res.items || []);
          setTotalCount(res.totalCount || 0);
        }
      } catch (err) {
        console.error(err);
        enqueueSnackbar('Lỗi tải dữ liệu', { variant: 'error' });
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [page, rowsPerPage, keyword, assetGroupId, assetTypeId, unitId, refreshTrigger, enqueueSnackbar]);

  const fetchStockCard = async (id: number) => {
    setLoadingStockCard(true);
    try {
      const res = await assetCategoryService.getAssetStockCard(id);
      setStockCardData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStockCard(false);
    }
  };

  const fetchInventoryBreakdown = async (id: number) => {
    setLoadingInventory(true);
    try {
      const res = await assetCategoryService.getAssetInventoryBreakdown(id);
      setInventoryData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInventory(false);
    }
  };

  useEffect(() => {
    if ((modalMode === 'view' || modalMode === 'edit') && draft?.id) {
      if (activeTab === 1) fetchStockCard(draft.id);
      if (activeTab === 2) fetchInventoryBreakdown(draft.id);
    }
  }, [modalMode, draft?.id, activeTab]);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, row: AssetCategory) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const handleOpenAdd = () => {
    setDraft({ code: '', name: '', description: '', assetGroupId: null, assetTypeId: null, manufacturerId: null, unitId: null, importPrice: 0, exportPrice: 0, depreciationRate: 0, imageUrls: [] });
    setModalMode('add');
  };

  const handleOpenView = (item: AssetCategory) => {
    setDraft(item);
    setModalMode('view');
  };

  const handleOpenEdit = (item: AssetCategory) => {
    setDraft(item);
    setModalMode('edit');
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setDraft(null);
    setActiveTab(0);
    setStockCardData([]);
    setInventoryData([]);
  };

  const handleSave = async () => {
    if (!draft || !draft.name) {
      enqueueSnackbar('Vui lòng nhập Tên tài sản', { variant: 'warning' });
      return;
    }

    try {
      if (modalMode === 'add') {
        await assetCategoryService.createAssetCategory(draft);
        enqueueSnackbar('Thêm mới thành công', { variant: 'success' });
      } else if (modalMode === 'edit') {
        await assetCategoryService.updateAssetCategory(draft);
        enqueueSnackbar('Cập nhật thành công', { variant: 'success' });
      }
      handleCloseModal();
      setRefreshTrigger(prev => prev + 1);
    } catch (_e) {
      enqueueSnackbar('Có lỗi xảy ra khi lưu dữ liệu', { variant: 'error' });
    }
  };

  const handleDelete = async (item: AssetCategory) => {
    if (confirm('Bạn có chắc chắn muốn xoá mục này?')) {
      try {
        if (item.id) await assetCategoryService.deleteAssetCategory(item.id);
        enqueueSnackbar('Xoá thành công', { variant: 'success' });
        setRefreshTrigger(prev => prev + 1);
      } catch (_e) {
        enqueueSnackbar('Có lỗi xảy ra khi xoá', { variant: 'error' });
      }
    }
  };

  const getGroupName = (id?: number | null) => assetGroups.find(x => x.id === id)?.name || '';
  const getTypeName = (id?: number | null) => assetTypes.find(x => x.id === id)?.name || '';
  const getUnitName = (id?: number | null) => assetUnits.find(x => x.id === id)?.name || '';

  const handleExportExcel = async () => {
    try {
      const res = await assetCategoryService.getAssetCategories(0, 5000, keyword, assetGroupId, assetTypeId, unitId);
      const exportData = res.items || [];
      if (exportData.length === 0) {
        enqueueSnackbar('Không có dữ liệu để xuất', { variant: 'warning' });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Danh mục tài sản');
      const headers = ['Mã tài sản', 'Tên tài sản', 'Thuộc nhóm', 'Loại tài sản', 'Đơn vị tính', 'Tồn kho', 'Giá nhập', 'Giá xuất', 'Tỷ lệ khấu hao (%)'];
      
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
          item.code || '',
          item.name || '',
          getGroupName(item.assetGroupId),
          getTypeName(item.assetTypeId),
          getUnitName(item.unitId),
          item.currentQuantity || 0,
          item.importPrice || 0,
          item.exportPrice || 0,
          item.depreciationRate || 0
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
      link.setAttribute('download', `DanhMucTaiSan_${new Date().getTime()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      enqueueSnackbar('Xuất file thành công', { variant: 'success' });
    } catch (_e) {
      enqueueSnackbar('Đã có lỗi xảy ra khi xuất file', { variant: 'error' });
    }
  };

  const handleExportStockCard = async () => {
    if (!draft?.id || stockCardData.length === 0) return;
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Thẻ kho');
      const headers = ['Chứng từ', 'Phương thức', 'Thời gian', 'Giá vốn', 'Số lượng', 'Tồn cuối'];
      
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      stockCardData.forEach(item => {
        const row = worksheet.addRow([
          item.receiptCode,
          item.method,
          new Date(item.time).toLocaleString('vi-VN'),
          item.unitPrice,
          item.quantity,
          item.balance
        ]);
        row.eachCell((cell) => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TheKho_${draft.code}_${new Date().getTime()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      enqueueSnackbar('Lỗi xuất file thẻ kho', { variant: 'error' });
    }
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, pt: 2, overflow: 'hidden' }}>
      
      {/* Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 1.5, flex: 1, minWidth: 300 }}>
          <TextField
            placeholder="Tìm kiếm mã, tên danh mục..."
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
            style={{ overflow: 'hidden' }}
          >
            <Box sx={{ 
              p: 2.5, borderRadius: 3, 
              bgcolor: 'rgba(15, 23, 42, 0.4)', 
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', gap: 2, flexWrap: 'wrap'
            }}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography sx={{ color: '#64748b', fontSize: 12, mb: 1, fontWeight: 500 }}>Nhóm tài sản</Typography>
                <select 
                  style={filterSelectStyle}
                  value={assetGroupId ?? ''}
                  onChange={(e) => setAssetGroupId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">Tất cả nhóm</option>
                  {assetGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Box>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography sx={{ color: '#64748b', fontSize: 12, mb: 1, fontWeight: 500 }}>Loại tài sản</Typography>
                <select 
                  style={filterSelectStyle}
                  value={assetTypeId ?? ''}
                  onChange={(e) => setAssetTypeId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">Tất cả loại</option>
                  {assetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Box>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography sx={{ color: '#64748b', fontSize: 12, mb: 1, fontWeight: 500 }}>Đơn vị tính</Typography>
                <select 
                  style={filterSelectStyle}
                  value={unitId ?? ''}
                  onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">Tất cả đơn vị</option>
                  {assetUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
                <Box 
                  component="button"
                  onClick={() => {
                    setAssetGroupId(undefined);
                    setAssetTypeId(undefined);
                    setUnitId(undefined);
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
              <TableCell sx={{ bgcolor: '#1a2332', color: '#9ca3af', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', py: 2 }}>THUỘC NHÓM</TableCell>
              <TableCell sx={{ bgcolor: '#1a2332', color: '#9ca3af', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', py: 2 }}>LOẠI</TableCell>
              <TableCell align="right" sx={{ bgcolor: '#1a2332', color: '#9ca3af', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', py: 2 }}>TỒN KHO</TableCell>
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
                    key={row.id ?? row.code}
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: index * 0.05 }}
                    style={{ transition: 'background-color 0.2s' }} className="hover:bg-white/5"
                  >
                    <TableCell sx={{ color: '#00B8DB', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.04)', py: 2.5, pl: 4 }}>{row.code}</TableCell>
                    <TableCell sx={{ color: '#e5e7eb', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.04)', py: 2.5 }}>{row.name}</TableCell>
                    <TableCell sx={{ color: '#e5e7eb', borderBottom: '1px solid rgba(255,255,255,0.04)', py: 2.5 }}>{getGroupName(row.assetGroupId)}</TableCell>
                    <TableCell sx={{ color: '#e5e7eb', borderBottom: '1px solid rgba(255,255,255,0.04)', py: 2.5 }}>{getTypeName(row.assetTypeId)}</TableCell>
                    <TableCell align="right" sx={{ color: '#00B8DB', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)', py: 2.5 }}>{row.currentQuantity || 0}</TableCell>
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

      {/* Pagination */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>Số hàng mỗi trang:</Typography>
          <Select
            value={rowsPerPage} onChange={(e) => { setRowsPerPage(e.target.value as number); setPage(0); }}
            size="small" sx={{ color: '#fff', fontSize: 13, height: 32, bgcolor: 'rgba(255,255,255,0.02)', '& .MuiSelect-icon': { color: '#9ca3af' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
          >
            <MenuItem value={10}>10</MenuItem><MenuItem value={20}>20</MenuItem><MenuItem value={50}>50</MenuItem>
          </Select>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>{totalCount === 0 ? '0-0 trên 0' : `${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, totalCount)} trên ${totalCount}`}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" disabled={page === 0} onClick={() => setPage(page - 1)} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.15)', bgcolor: 'rgba(255,255,255,0.02)', textTransform: 'none', minWidth: 'unset', px: 2, py: 0.5, '&.Mui-disabled': { color: '#6b7280', borderColor: 'rgba(255,255,255,0.05)' } }}>Trước</Button>
            <Button variant="outlined" disabled={(page + 1) * rowsPerPage >= totalCount} onClick={() => setPage(page + 1)} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.15)', bgcolor: 'rgba(255,255,255,0.02)', textTransform: 'none', minWidth: 'unset', px: 2, py: 0.5, '&.Mui-disabled': { color: '#6b7280', borderColor: 'rgba(255,255,255,0.05)' } }}>Sau</Button>
          </Box>
        </Box>
      </Box>

      {/* Menu Actions */}
      <Menu
        anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ sx: { bgcolor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', borderRadius: 2, minWidth: 120, mt: 0.5, '& .MuiMenuItem-root': { fontSize: 14, px: 3, py: 1.5, fontWeight: 500, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } } } }}
      >
        <MenuItem onClick={() => { handleCloseMenu(); if (selectedRow) handleOpenView(selectedRow); }}><VisibilityOutlinedIcon fontSize="small" sx={{ mr: 1.5, color: '#9ca3af' }} />Xem</MenuItem>
        <MenuItem onClick={() => { handleCloseMenu(); if (selectedRow) handleOpenEdit(selectedRow); }}><EditOutlinedIcon fontSize="small" sx={{ mr: 1.5, color: '#9ca3af' }} />Sửa</MenuItem>
        <MenuItem onClick={() => { handleCloseMenu(); if (selectedRow) handleDelete(selectedRow); }} sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1) !important' } }}><DeleteOutlineIcon fontSize="small" sx={{ mr: 1.5 }} />Xóa</MenuItem>
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
        sx={{ "& .MuiDialog-container": { alignItems: "center" } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, pt: 3, pb: 1 }}>
          <Typography sx={{ color: "#00e5ff", fontWeight: 700, fontSize: 18 }}>{modalMode === 'add' ? 'Thêm mới' : modalMode === 'edit' ? 'Cập nhật' : 'Chi tiết'} Danh mục Tài sản</Typography>
          <Box component="button" onClick={handleCloseModal} sx={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", p: 0.5, "&:hover": { color: "#94a3b8" } }}><X size={20} /></Box>
        </Box>

        {modalMode !== 'add' && (
          <Box sx={{ px: 3, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Tabs 
              value={activeTab} 
              onChange={(_, v) => setActiveTab(v)}
              sx={{
                '& .MuiTab-root': { color: '#64748b', textTransform: 'none', fontWeight: 600, fontSize: 14, minWidth: 120 },
                '& .Mui-selected': { color: '#00B8DB !important' },
                '& .MuiTabs-indicator': { bgcolor: '#00B8DB', height: 3, borderRadius: '3px 3px 0 0' }
              }}
            >
              <Tab label="Thông tin chung" />
              <Tab label="Thẻ kho" />
              <Tab label="Tồn kho" />
            </Tabs>
          </Box>
        )}

        <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
          {activeTab === 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
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
                    value={draft?.code ?? ""}
                    readOnly={modalMode !== 'add'}
                    placeholder={modalMode === 'add' ? 'Tự động sinh nếu để trống...' : ''}
                    onChange={(e) => setDraft((d) => d ? { ...d, code: e.target.value } : d)}
                  />
                </Box>
                <Box sx={{ flex: 2 }}>
                  <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Tên tài sản {modalMode !== 'view' && <span style={{color: "#ef4444"}}>*</span>}</Typography>
                  <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.name ?? ""} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, name: e.target.value } : d)} />
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Thuộc nhóm tài sản</Typography>
                  <select disabled={modalMode === 'view'} style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.assetGroupId ?? ''} onChange={(e) => setDraft((d) => d ? { ...d, assetGroupId: e.target.value ? Number(e.target.value) : null } : d)}>
                    <option value="" style={{ background: '#0d1b2e' }}>-- Không chọn --</option>
                    {assetGroups.map(g => <option key={g.id} value={g.id} style={{ background: '#0d1b2e' }}>{g.name}</option>)}
                  </select>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Loại tài sản</Typography>
                  <select disabled={modalMode === 'view'} style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.assetTypeId ?? ''} onChange={(e) => setDraft((d) => d ? { ...d, assetTypeId: e.target.value ? Number(e.target.value) : null } : d)}>
                    <option value="" style={{ background: '#0d1b2e' }}>-- Không chọn --</option>
                    {assetTypes.map(t => <option key={t.id} value={t.id} style={{ background: '#0d1b2e' }}>{t.name}</option>)}
                  </select>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Nhà sản xuất</Typography>
                  <select disabled={modalMode === 'view'} style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.manufacturerId ?? ''} onChange={(e) => setDraft((d) => d ? { ...d, manufacturerId: e.target.value ? Number(e.target.value) : null } : d)}>
                    <option value="" style={{ background: '#0d1b2e' }}>-- Không chọn --</option>
                    {manufacturers.map(m => <option key={m.id} value={m.id} style={{ background: '#0d1b2e' }}>{m.name}</option>)}
                  </select>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Đơn vị tính</Typography>
                  <select disabled={modalMode === 'view'} style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.unitId ?? ''} onChange={(e) => setDraft((d) => d ? { ...d, unitId: e.target.value ? Number(e.target.value) : null } : d)}>
                    <option value="" style={{ background: '#0d1b2e' }}>-- Không chọn --</option>
                    {assetUnits.map(u => <option key={u.id} value={u.id} style={{ background: '#0d1b2e' }}>{u.name}</option>)}
                  </select>
                </Box>
              </Box>

              <Box sx={{ display: "flex", gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Giá nhập</Typography>
                  <CurrencyInput
                    value={draft?.importPrice ?? 0}
                    readOnly={modalMode === 'view'}
                    onChange={(val) => setDraft((d) => d ? { ...d, importPrice: val } : d)}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Giá xuất</Typography>
                  <CurrencyInput
                    value={draft?.exportPrice ?? 0}
                    readOnly={modalMode === 'view'}
                    onChange={(val) => setDraft((d) => d ? { ...d, exportPrice: val } : d)}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Tỷ lệ khấu hao (%)</Typography>
                  <input type="number" style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.6 : 1, cursor: modalMode === 'view' ? 'not-allowed' : 'text' }} value={draft?.depreciationRate ?? 0} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, depreciationRate: Number(e.target.value) } : d)} />
                </Box>
              </Box>

              <Box>
                <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Mô tả</Typography>
                <textarea style={{ ...fieldStyle, minHeight: '80px', resize: 'vertical', opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.description ?? ""} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, description: e.target.value } : d)} />
              </Box>

              {/* Hình ảnh */}
              <Box>
                <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Hình ảnh</Typography>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleImageSelect}
                />
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {(draft?.imageUrls || []).map((url, index) => (
                    <Box key={index} sx={{ position: 'relative', display: 'inline-block' }}>
                      <Box
                        component="img"
                        src={url}
                        alt={`Ảnh ${index + 1}`}
                        sx={{
                          width: 160,
                          height: 160,
                          objectFit: 'cover',
                          borderRadius: 2,
                          border: '1px solid rgba(255,255,255,0.12)',
                        }}
                      />
                      {modalMode !== 'view' && (
                        <Box
                          component="button"
                          onClick={() => handleRemoveImage(index)}
                          sx={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            bgcolor: 'rgba(239,68,68,0.9)',
                            border: 'none',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            p: 0,
                            '&:hover': { bgcolor: '#ef4444' },
                          }}
                        >
                          <X size={14} />
                        </Box>
                      )}
                    </Box>
                  ))}
                  {modalMode !== 'view' && (
                    <Box
                      onClick={() => fileInputRef.current?.click()}
                      sx={{
                        width: 160,
                        height: 160,
                        border: '2px dashed rgba(255,255,255,0.15)',
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: 'rgba(0,200,255,0.4)',
                          bgcolor: 'rgba(0,200,255,0.05)',
                        },
                      }}
                    >
                      <ImageIcon size={28} color="#64748b" />
                      <Typography sx={{ color: '#64748b', fontSize: 13 }}>
                        Thêm hình ảnh
                      </Typography>
                    </Box>
                  )}
                  {modalMode === 'view' && (!draft?.imageUrls || draft.imageUrls.length === 0) && (
                    <Box
                      sx={{
                        width: 160,
                        height: 160,
                        border: '2px dashed rgba(255,255,255,0.05)',
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        bgcolor: 'rgba(0,0,0,0.1)'
                      }}
                    >
                      <ImageIcon size={28} color="#475569" />
                      <Typography sx={{ color: '#475569', fontSize: 13 }}>
                        Không có ảnh
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              <Box sx={{ display: "flex", gap: 1.5, pt: 1 }}>
                {modalMode !== 'view' && (
                  <Box component="button" onClick={handleSave} sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, py: 1.25, borderRadius: 2, border: "none", bgcolor: "#00c8ff", color: "#020617", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", "&:hover": { bgcolor: "#00e5ff" } }}><Save size={16} /> Lưu thông tin</Box>
                )}
                <Box component="button" onClick={handleCloseModal} sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, py: 1.25, borderRadius: 2, border: "none", bgcolor: "rgba(255,255,255,0.1)", color: "#f1f5f9", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", "&:hover": { bgcolor: "rgba(255,255,255,0.15)", color: "#ffffff" } }}>{modalMode === 'view' ? 'Đóng' : 'Hủy bỏ'}</Box>
              </Box>
            </Box>
          ) : activeTab === 1 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button 
                  startIcon={<FileDownloadOutlinedIcon />} 
                  variant="outlined" 
                  onClick={handleExportStockCard}
                  disabled={stockCardData.length === 0}
                  sx={{ color: '#d1d5db', borderColor: 'rgba(255,255,255,0.15)', textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                >
                  Xuất file
                </Button>
              </Box>

              <TableContainer sx={{ 
                flex: 1, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, 
                bgcolor: 'rgba(0,0,0,0.2)',
                '&::-webkit-scrollbar': { width: 4, height: 4 },
                '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: 4 }
              }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: '#1e293b', color: '#94a3b8', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>CHỨNG TỪ</TableCell>
                      <TableCell sx={{ bgcolor: '#1e293b', color: '#94a3b8', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>PHƯƠNG THỨC</TableCell>
                      <TableCell sx={{ bgcolor: '#1e293b', color: '#94a3b8', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>THỜI GIAN</TableCell>
                      <TableCell align="right" sx={{ bgcolor: '#1e293b', color: '#94a3b8', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>GIÁ VỐN</TableCell>
                      <TableCell align="right" sx={{ bgcolor: '#1e293b', color: '#94a3b8', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>SỐ LƯỢNG</TableCell>
                      <TableCell align="right" sx={{ bgcolor: '#1e293b', color: '#94a3b8', fontWeight: 600, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>TỒN CUỐI</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loadingStockCard ? (
                      <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, border: 'none' }}><CircularProgress size={24} sx={{ color: '#00B8DB' }} /></TableCell></TableRow>
                    ) : stockCardData.length > 0 ? (
                      stockCardData.map((item, idx) => (
                        <TableRow key={idx} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                          <TableCell sx={{ color: '#00B8DB', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{item.receiptCode}</TableCell>
                          <TableCell sx={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{item.method}</TableCell>
                          <TableCell sx={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>
                            {new Date(item.time).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{formatVND(item.unitPrice)}</TableCell>
                          <TableCell align="right" sx={{ color: item.quantity > 0 ? '#10b981' : item.quantity < 0 ? '#ef4444' : '#eab308', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {item.quantity > 0 ? `+${item.quantity}` : item.quantity === 0 ? '0' : item.quantity}
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#00B8DB', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{item.balance}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: '#64748b', border: 'none' }}>Chưa có dữ liệu biến động kho</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
              <TableContainer sx={{ 
                flex: 1, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, 
                bgcolor: 'rgba(0,0,0,0.2)',
                '&::-webkit-scrollbar': { width: 4, height: 4 },
                '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: 4 }
              }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: '#1e293b', color: '#94a3b8', fontWeight: 600, fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>TÊN KHO</TableCell>
                      <TableCell align="right" sx={{ bgcolor: '#1e293b', color: '#94a3b8', fontWeight: 600, fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>SỐ LƯỢNG TỒN</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loadingInventory ? (
                      <TableRow><TableCell colSpan={2} align="center" sx={{ py: 6, border: 'none' }}><CircularProgress size={24} sx={{ color: '#00B8DB' }} /></TableCell></TableRow>
                    ) : inventoryData.length > 0 ? (
                      inventoryData.map((item, idx) => (
                        <TableRow key={idx} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                          <TableCell sx={{ color: '#e2e8f0', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{item.warehouseName}</TableCell>
                          <TableCell align="right" sx={{ color: '#00B8DB', fontWeight: 700, fontSize: 15, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{item.quantity}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={2} align="center" sx={{ py: 6, color: '#64748b', border: 'none' }}>Tài sản này chưa có tồn kho tại bất kỳ kho nào</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      </Dialog>
    </Box>
  );
};
