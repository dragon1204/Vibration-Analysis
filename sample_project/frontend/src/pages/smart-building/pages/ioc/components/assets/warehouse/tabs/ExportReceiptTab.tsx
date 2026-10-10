import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  Divider,
  IconButton,
  InputAdornment,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useSnackbar } from 'notistack';
import ExcelJS from 'exceljs';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import { X } from 'lucide-react';
import { DateInput } from '@/components/field/DateInput';
import { DateTimeInput } from '@/components/field/DateTimeInput';
import { SearchableSelect } from '@/components/field/SearchableSelect';
import type { SelectOption } from '@/components/field/SearchableSelect';
import { CurrencyInput } from '@/components/field/CurrencyInput';
import { categoryService } from '@/services/ioc/category.service';
import { assetCategoryService } from '@/services/ioc/assetCategory.service';
import type { AssetCategory } from '@/services/ioc/assetCategory.service';
import { userService } from '@/pages/smart-building/services/user.service';
import { exportReceiptService } from '@/services/ioc/exportReceipt.service';

/* ─── Types ─────────────────────────────────────────────────────────── */
export interface WarehouseCategory {
  id?: number;
  code: string;
  name: string;
  description?: string;
  location?: string;
  managerId?: number;
  managerName?: string;
}

export interface ExportReceiptDetail {
  id?: number;
  assetCategoryId: number;
  assetCategoryName?: string;
  unit?: string;
  unitName?: string;
  quantity: number;
  unitPrice: number;
  finalAmount: number;
}

export interface ExportReceipt {
  id?: number;
  code: string;
  warehouseCategoryId: number;
  warehouseCategoryName?: string;
  exportType: number;
  toWarehouseCategoryId?: number | null;
  toWarehouseCategoryName?: string;
  exportDate: string;
  exportDestination: string;
  reason: string;
  receiver: string;
  creatorId?: number | null;
  creatorName?: string;
  accountantId?: number | null;
  accountantName?: string;
  storekeeperId?: number | null;
  storekeeperName?: string;
  approverId?: number | null;
  approverName?: string;
  approveDate?: string | null;
  status: number;
  otherCosts: number;
  totalAmount: number;
  finalAmount: number;
  details: ExportReceiptDetail[];
}

/* ─── Constants ──────────────────────────────────────────────────────── */
const STATUSES = [
  { value: 0, label: 'Nháp',      color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  { value: 1, label: 'Chờ duyệt', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  { value: 2, label: 'Đã duyệt',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  { value: 3, label: 'Đã hủy',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
];
const getStatus = (v: number) => STATUSES.find(s => s.value === v) ?? STATUSES[0];

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 12px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 13,
  outline: 'none',
  height: 38,
};

const formatVND = (v: number) =>
  v.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const computeTotals = (details: ExportReceiptDetail[], otherCosts: number) => {
  const total = details.reduce((s, d) => s + d.finalAmount, 0);
  const final = total + otherCosts;
  return { totalAmount: total, finalAmount: final };
};

const emptyReceipt = (): Partial<ExportReceipt> => ({
  code: '', warehouseCategoryId: 0, exportDate: new Date().toISOString(),
  exportType: 1, toWarehouseCategoryId: null, exportDestination: '',
  reason: '', receiver: '',
  status: 0, otherCosts: 0, totalAmount: 0, finalAmount: 0, details: [],
});

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export const ExportReceiptTab: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();

  /* ── List state ─── */
  const [data, setData] = useState<ExportReceipt[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | ''>('');
  const [exportTypeFilter, setExportTypeFilter] = useState<number | ''>('');
  const [warehouseFilter, setWarehouseFilter] = useState<number | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseCategory[]>([]);

  /* ── Menu / Modal ─── */
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<ExportReceipt | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [draft, setDraft] = useState<Partial<ExportReceipt> | null>(null);

  /* ── Goods picker state ─── */
  const [pickerCategoryId, setPickerCategoryId] = useState<number | null>(null);
  const [pickerCategoryMeta, setPickerCategoryMeta] = useState<AssetCategory | null>(null);

  /* ── Filter & paginate (fetch) ─── */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await exportReceiptService.getAll({
        keyword,
        status: statusFilter === '' ? undefined : (statusFilter as number),
        exportType: exportTypeFilter === '' ? undefined : (exportTypeFilter as number),
        warehouseCategoryId: warehouseFilter === '' ? undefined : (warehouseFilter as number),
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        skipCount: page * rowsPerPage,
        maxResultCount: rowsPerPage,
      });
      setData((res.items as unknown as ExportReceipt[]) || []);
      setTotalCount(res.totalCount || 0);
    } catch {
      enqueueSnackbar('Lỗi tải danh sách phiếu xuất', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [keyword, statusFilter, exportTypeFilter, warehouseFilter, fromDate, toDate, page, rowsPerPage, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  useEffect(() => {
    categoryService.getWarehouseCategories(0, 200, '').then(res => setWarehouseOptions(res.items || [])).catch(() => {});
  }, []);

  /* ── Fetch helpers ─── */
  const fetchWarehouseOptions = useCallback(async (kw: string): Promise<SelectOption[]> => {
    try {
      const res = await categoryService.getWarehouseCategories(0, 50, kw);
      return (res.items || []).filter(w => w.id).map(w => ({ value: w.id as number, label: w.name }));
    } catch { return []; }
  }, []);

  const fetchUserOptions = useCallback(async (kw: string): Promise<SelectOption[]> => {
    try {
      const res = await userService.getAll({ keyword: kw, maxResultCount: 50, skipCount: 0 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = Array.isArray(res?.data) ? res.data : []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return items.map((u: any) => ({
        value: u.id,
        label: u.fullName,
      }));
    } catch { return []; }
  }, []);

  const fetchAssetCategoryOptions = useCallback(async (kw: string): Promise<SelectOption[]> => {
    try {
      const res = await assetCategoryService.getAssetCategories(0, 50, kw);
      return (res.items || []).filter(c => c.id).map(c => ({
        value: c.id as number,
        label: `${c.code} – ${c.name}`,
      }));
    } catch { return []; }
  }, []);

  /* ── When warehouse selected: auto-fill storekeeper ─── */
  const handleWarehouseChange = async (val: number | string | null) => {
    const id = val ? Number(val) : 0;
    if (!id) {
      setDraft(d => d ? { ...d, warehouseCategoryId: 0, warehouseCategoryName: '', storekeeperId: null, storekeeperName: '' } : d);
      return;
    }
    try {
      const res = await categoryService.getWarehouseCategories(0, 200, '');
      const found: WarehouseCategory | undefined = (res.items || []).find(w => w.id === id);
      setDraft(d => {
        if (!d) return d;
        const patch: Partial<ExportReceipt> = {
          warehouseCategoryId: id,
          warehouseCategoryName: found?.name ?? '',
        };
        // Auto-fill storekeeper from warehouse manager
        if (found?.managerId) {
          patch.storekeeperId = found.managerId;
          patch.storekeeperName = found.managerName; 
        } else {
          patch.storekeeperId = null;
          patch.storekeeperName = '';
        }
        return { ...d, ...patch };
      });
    } catch {
      setDraft(d => d ? { ...d, warehouseCategoryId: id } : d);
    }
  };

  /* ── Picker: when category selected, resolve meta ─── */
  const handlePickerCategoryChange = async (val: number | string | null) => {
    setPickerCategoryId(val ? Number(val) : null);
    if (!val) { setPickerCategoryMeta(null); return; }
    try {
      const res = await assetCategoryService.getAssetCategories(0, 200, '');
      const found = (res.items || []).find(c => c.id === Number(val)) ?? null;
      setPickerCategoryMeta(found);
    } catch { setPickerCategoryMeta(null); }
  };

  /* ── Add row from picker ─── */
  const handleAddDetailRow = () => {
    if (!pickerCategoryId) {
      enqueueSnackbar('Vui lòng chọn danh mục hàng hoá trước!', { variant: 'warning' });
      return;
    }
    
    setDraft(d => {
      if (!d) return d;
      const details = [...(d.details || [])];
      
      const existingIdx = details.findIndex(x => x.assetCategoryId === pickerCategoryId);
      if (existingIdx > -1) {
        // Increment quantity if exists
        const row = { ...details[existingIdx] };
        row.quantity += 1;
        row.finalAmount = row.quantity * row.unitPrice;
        details[existingIdx] = row;
      } else {
        // Add new row
        const meta = pickerCategoryMeta;
        const qty = 1;
        const price = meta?.importPrice ?? 0;
        const newRow: ExportReceiptDetail = {
          assetCategoryId: pickerCategoryId,
          assetCategoryName: meta ? `${meta.code} – ${meta.name}` : `ID:${pickerCategoryId}`,
          unit: meta?.unitName || '',
          quantity: qty,
          unitPrice: price,
          finalAmount: qty * price,
        };
        details.push(newRow);
      }
      
      return { ...d, details, ...computeTotals(details, d.otherCosts ?? 0) };
    });

    setPickerCategoryId(null);
    setPickerCategoryMeta(null);
  };

  /* ── Update / remove detail row ─── */
  const updateDetail = (idx: number, patch: Partial<ExportReceiptDetail>) => {
    setDraft(d => {
      if (!d) return d;
      const details = [...(d.details || [])];
      const row = { ...details[idx], ...patch };
      
      row.finalAmount = row.quantity * row.unitPrice;
      details[idx] = row;
      return { ...d, details, ...computeTotals(details, d.otherCosts ?? 0) };
    });
  };

  const removeDetailRow = (idx: number) => {
    setDraft(d => {
      if (!d) return d;
      const details = (d.details || []).filter((_, i) => i !== idx);
      return { ...d, details, ...computeTotals(details, d.otherCosts ?? 0) };
    });
  };

  const updateCost = (patch: { otherCosts?: number }) => {
    setDraft(d => {
      if (!d) return d;
      let otherCosts = patch.otherCosts ?? d.otherCosts ?? 0;

      if (patch.otherCosts !== undefined) {
        otherCosts = Math.max(0, patch.otherCosts);
      }

      return { ...d, ...patch, otherCosts, ...computeTotals(d.details || [], otherCosts) };
    });
  };

  /* ── Modal handlers ─── */
  const openAdd  = () => { setPickerCategoryId(null); setPickerCategoryMeta(null); setDraft(emptyReceipt()); setModalMode('add'); };
  
  const openView = async (r: ExportReceipt) => { 
    try {
      const full = r.id !== undefined ? await exportReceiptService.getById(r.id) : null;
      setDraft((full as unknown as ExportReceipt) ?? r); 
      setModalMode('view');
    } catch { enqueueSnackbar('Lỗi lấy chi tiết phiếu', { variant: 'error' }); }
  };

  const openEdit = async (r: ExportReceipt) => { 
    try {
      setPickerCategoryId(null); 
      setPickerCategoryMeta(null); 
      const full = r.id !== undefined ? await exportReceiptService.getById(r.id) : null;
      setDraft((full as unknown as ExportReceipt) ?? r); 
      setModalMode('edit');
    } catch { enqueueSnackbar('Lỗi lấy chi tiết phiếu', { variant: 'error' }); }
  };
  
  const closeModal = () => { setModalMode(null); setDraft(null); };

  const handleSave = async (submitForApproval = false) => {
    const finalDraft = { ...draft };
    if (submitForApproval) {
      finalDraft.status = 1;
    }
    if (!finalDraft.code?.trim()) {
      finalDraft.code = `PX-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    if (!finalDraft.warehouseCategoryId) { enqueueSnackbar('Vui lòng chọn kho xuất!', { variant: 'warning' }); return; }
    if (!finalDraft.reason?.trim()) { enqueueSnackbar('Vui lòng nhập lý do lập phiếu!', { variant: 'warning' }); return; }
    if (!finalDraft.details || finalDraft.details.length === 0) { enqueueSnackbar('Phiếu xuất phải có ít nhất một mặt hàng!', { variant: 'warning' }); return; }
    
    try {
      if (modalMode === 'add') {
        await exportReceiptService.create(finalDraft);
        enqueueSnackbar(submitForApproval ? 'Tạo và gửi duyệt thành công!' : 'Tạo phiếu xuất thành công!', { variant: 'success' });
      } else {
        await exportReceiptService.update(finalDraft);
        enqueueSnackbar(submitForApproval ? 'Gửi phê duyệt thành công!' : 'Cập nhật thành công!', { variant: 'success' });
      }
      setRefreshTrigger(t => t + 1);
      closeModal();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || (e instanceof Error ? e.message : 'Có lỗi xảy ra');
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await exportReceiptService.approve(id);
      enqueueSnackbar('Đã duyệt phiếu thành công', { variant: 'success' });
      setRefreshTrigger(t => t + 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || (e instanceof Error ? e.message : 'Lỗi duyệt phiếu');
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await exportReceiptService.cancel(id);
      enqueueSnackbar('Đã hủy phiếu', { variant: 'info' });
      setRefreshTrigger(t => t + 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || (e instanceof Error ? e.message : 'Lỗi hủy phiếu');
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await exportReceiptService.delete(id);
      enqueueSnackbar('Đã xóa phiếu', { variant: 'success' });
      setRefreshTrigger(t => t + 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || (e instanceof Error ? e.message : 'Lỗi xóa phiếu');
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Danh sách phiếu xuất');

      const headers = ['Mã phiếu', 'Kho xuất', 'Kho nhận', 'Ngày xuất', 'Người lập', 'Người nhận', 'Loại xuất', 'Tổng tiền', 'Trạng thái'];
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      data.forEach(item => {
        const row = worksheet.addRow([
          item.code,
          item.warehouseCategoryName,
          item.toWarehouseCategoryName || '-',
          item.exportDate ? new Date(item.exportDate).toLocaleString('vi-VN') : '',
          item.creatorName || '-',
          item.receiver || '-',
          item.exportType === 1 ? 'Xuất sử dụng' : 'Xuất luân chuyển',
          item.totalAmount,
          item.status === 0 ? 'Nháp' : item.status === 1 ? 'Chờ duyệt' : item.status === 2 ? 'Đã duyệt' : 'Đã hủy'
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
      link.setAttribute('download', `PhieuXuat_${new Date().getTime()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      enqueueSnackbar('Xuất file thành công', { variant: 'success' });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      enqueueSnackbar('Lỗi xuất file excel', { variant: 'error' });
    }
  };

  const isReadOnly = modalMode === 'view';

  /* ═══ RENDER ═══════════════════════════════════════════════════════ */
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 3, flex: 1, overflow: 'hidden' }}>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <TextField
          fullWidth placeholder="Tìm kiếm theo mã phiếu, lý do xuất..." value={keyword}
          onChange={e => { setKeyword(e.target.value); setPage(0); }}
          sx={{ flex: 1, '& .MuiOutlinedInput-root': { color: '#fff', bgcolor: 'rgba(15,23,42,0.4)', borderRadius: 2, height: '46px', '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&.Mui-focused fieldset': { borderColor: '#00B8DB' } }, '& .MuiInputBase-input::placeholder': { color: '#9ca3af', opacity: 1 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#9ca3af', fontSize: 20 }} /></InputAdornment> }}
        />
        <Button
          variant="outlined" startIcon={<FilterAltOutlinedIcon />}
          onClick={() => setShowFilters(f => !f)}
          sx={{ color: showFilters ? '#00B8DB' : '#d1d5db', borderColor: showFilters ? '#00B8DB' : 'rgba(255,255,255,0.15)', fontWeight: 500, textTransform: 'none', borderRadius: 2, px: 3, height: '46px', whiteSpace: 'nowrap', bgcolor: showFilters ? 'rgba(0,184,219,0.08)' : 'rgba(255,255,255,0.02)', '&:hover': { borderColor: '#00B8DB', bgcolor: 'rgba(0,184,219,0.08)', color: '#00B8DB' } }}
        >
          Bộ lọc {(statusFilter !== '' || exportTypeFilter !== '' || warehouseFilter !== '' || fromDate || toDate) && '●'}
        </Button>
        <Button startIcon={<FileDownloadOutlinedIcon />} variant="outlined"
          onClick={handleExportExcel}
          sx={{ color: '#d1d5db', borderColor: 'rgba(255,255,255,0.15)', fontWeight: 500, textTransform: 'none', borderRadius: 2, px: 3, height: '46px', whiteSpace: 'nowrap', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.05)' } }}>
          Xuất Excel
        </Button>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openAdd}
          sx={{ bgcolor: '#00B8DB', color: '#fff', textTransform: 'none', fontWeight: 700, px: 3, height: '46px', borderRadius: 2, whiteSpace: 'nowrap', boxShadow: 'none', '&:hover': { bgcolor: '#0097B5', boxShadow: 'none' } }}>
          Tạo phiếu xuất
        </Button>
      </Box>

      {/* ── Filter panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', p: 2.5, borderRadius: 2, bgcolor: '#33333387', border: '1px solid rgba(255,255,255,0.07)', alignItems: 'flex-end' }}>
              {/* Trạng thái */}
              <Box sx={{ minWidth: 180 }}>
                <Typography sx={{ color: '#64748b', fontSize: 12, mb: 1, fontWeight: 600 }}>Trạng thái</Typography>
                <select style={fieldStyle} value={statusFilter} onChange={e => { setStatusFilter(e.target.value === '' ? '' : Number(e.target.value)); setPage(0); }}>
                  <option value="">Tất cả trạng thái</option>
                  {STATUSES.map(s => <option key={s.value} value={s.value} style={{ background: '#0d1b2e' }}>{s.label}</option>)}
                </select>
              </Box>
              {/* Loại xuất */}
              <Box sx={{ minWidth: 180 }}>
                <Typography sx={{ color: '#64748b', fontSize: 12, mb: 1, fontWeight: 600 }}>Loại xuất</Typography>
                <select style={fieldStyle} value={exportTypeFilter} onChange={e => { setExportTypeFilter(e.target.value === '' ? '' : Number(e.target.value)); setPage(0); }}>
                  <option value="">Tất cả loại</option>
                  <option value={1} style={{ background: '#0d1b2e' }}>Xuất sử dụng</option>
                  <option value={2} style={{ background: '#0d1b2e' }}>Xuất luân chuyển</option>
                </select>
              </Box>
              {/* Kho xuất */}
              <Box sx={{ minWidth: 180 }}>
                <Typography sx={{ color: '#64748b', fontSize: 12, mb: 1, fontWeight: 600 }}>Kho xuất</Typography>
                <select style={fieldStyle} value={warehouseFilter} onChange={e => { setWarehouseFilter(e.target.value === '' ? '' : Number(e.target.value)); setPage(0); }}>
                  <option value="">Tất cả kho</option>
                  {warehouseOptions.map(w => <option key={w.id} value={w.id} style={{ background: '#0d1b2e' }}>{w.name}</option>)}
                </select>
              </Box>
              {/* Từ ngày */}
             <Box sx={{ minWidth: 160 }}>
                <Typography sx={{ color: '#64748b', fontSize: 12, mb: 1, fontWeight: 600 }}>Từ ngày</Typography>
                <DateInput 
                  value={fromDate} 
                  onChange={val => { setFromDate(val || ''); setPage(0); }}
                  style={fieldStyle}
                />
              </Box>
              {/* Đến ngày */}
              <Box sx={{ minWidth: 160 }}>
                <Typography sx={{ color: '#64748b', fontSize: 12, mb: 1, fontWeight: 600 }}>Đến ngày</Typography>
                <DateInput 
                  value={toDate} 
                  onChange={val => { setToDate(val || ''); setPage(0); }}
                  style={fieldStyle}
                />
              </Box>
              {/* Xóa lọc */}
              <Box>
                <Box component="button"
                  onClick={() => { setStatusFilter(''); setExportTypeFilter(''); setWarehouseFilter(''); setFromDate(''); setToDate(''); setPage(0); }}
                  sx={{ height: 38, px: 2.5, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 13, '&:hover': { color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' } }}>
                  Xóa lọc
                </Box>
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <Box sx={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, bgcolor: 'rgba(15,23,42,0.4)', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TableContainer sx={{ flex: 1, '&::-webkit-scrollbar': { width: 6, height: 6 }, '&::-webkit-scrollbar-track': { background: 'transparent' }, '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: 8 } }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {[{ h: 'MÃ PHIẾU' }, { h: 'KHO XUẤT' }, { h: 'NGÀY XUẤT' }, { h: 'NGƯỜI NHẬN' }, { h: 'LÝ DO XUẤT' }, { h: 'TỔNG TIỀN' }, { h: 'TRẠNG THÁI' }, { h: 'HÀNH ĐỘNG', right: true }].map(({ h, right }) => (
                  <TableCell key={h} align={right ? 'right' : 'left'}
                    sx={{ bgcolor: '#111827', color: '#64748b', fontWeight: 700, fontSize: 11, letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.08)', py: 1.8, whiteSpace: 'nowrap' }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <AnimatePresence>
                {loading ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 8, borderBottom: 'none' }}><CircularProgress size={28} sx={{ color: '#00B8DB' }} /></TableCell></TableRow>
                ) : data.length > 0 ? data.map((row, idx) => {
                  const st = getStatus(row.status);
                  return (
                    <motion.tr key={row.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: idx * 0.04 }} className="hover:bg-white/5" style={{ transition: 'background-color 0.2s' }}>
                      <TableCell sx={{ color: '#00B8DB', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1.8, pl: 2 }}>{row.code}</TableCell>
                      <TableCell sx={{ color: '#e5e7eb', borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1.8 }}>{row.warehouseCategoryName || '—'}</TableCell>
                      <TableCell sx={{ color: '#e5e7eb', borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1.8, whiteSpace: 'nowrap' }}>
                        {row.exportDate ? new Date(row.exportDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </TableCell>
                      <TableCell sx={{ color: '#e5e7eb', borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1.8 }}>{row.receiver || '—'}</TableCell>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1.8, maxWidth: 260 }}>
                        <Typography noWrap sx={{ fontSize: 13, color: '#94a3b8' }}>{row.reason}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: '#e5e7eb', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1.8, whiteSpace: 'nowrap' }}>{formatVND(row.finalAmount)}</TableCell>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1.8 }}>
                        <Chip label={st.label} size="small" sx={{ bgcolor: st.bg, color: st.color, fontWeight: 600, fontSize: 11, height: 22, border: `1px solid ${st.color}30` }} />
                      </TableCell>
                      <TableCell align="right" sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1.8, pr: 1.5 }}>
                        {row.status === 1 && (
                          <Tooltip title="Phê duyệt">
                            <IconButton size="small" onClick={() => handleApprove(row.id ?? 0)}
                              sx={{ color: '#22c55e', mr: 0.5, '&:hover': { bgcolor: 'rgba(34,197,94,0.1)' } }}>
                              <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <IconButton size="small" onClick={e => { setAnchorEl(e.currentTarget); setSelectedRow(row); }}
                          sx={{ color: '#64748b', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
                          <MoreVertIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </TableCell>
                    </motion.tr>
                  );
                }) : (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 10, borderBottom: 'none' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                      <InventoryOutlinedIcon sx={{ fontSize: 40, color: '#1e293b' }} />
                      <Typography sx={{ color: '#475569', fontSize: 14 }}>Chưa có phiếu xuất nào</Typography>
                    </Box>
                  </TableCell></TableRow>
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>Số hàng mỗi trang:</Typography>
            <Select value={rowsPerPage} onChange={(e) => { setRowsPerPage(e.target.value as number); setPage(0); }} size="small"
              sx={{ color: '#fff', fontSize: 13, height: 32, bgcolor: 'rgba(255,255,255,0.02)', '& .MuiSelect-icon': { color: '#9ca3af' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}>
              <MenuItem value={10}>10</MenuItem><MenuItem value={20}>20</MenuItem><MenuItem value={50}>50</MenuItem>
            </Select>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>
              {totalCount === 0 ? '0-0 trên 0' : `${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, totalCount)} trên ${totalCount}`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.15)', bgcolor: 'rgba(255,255,255,0.02)', textTransform: 'none', minWidth: 'unset', px: 2, py: 0.5, '&.Mui-disabled': { color: '#374151', borderColor: 'rgba(255,255,255,0.05)' } }}>Trước</Button>
              <Button variant="outlined" disabled={(page + 1) * rowsPerPage >= totalCount} onClick={() => setPage(p => p + 1)}
                sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.15)', bgcolor: 'rgba(255,255,255,0.02)', textTransform: 'none', minWidth: 'unset', px: 2, py: 0.5, '&.Mui-disabled': { color: '#374151', borderColor: 'rgba(255,255,255,0.05)' } }}>Sau</Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Row context menu ─────────────────────────────────────────── */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} disableScrollLock
        PaperProps={{ sx: { bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, mt: 1, minWidth: 180, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' } }}>
        <MenuItem onClick={() => { setAnchorEl(null); if (selectedRow) openView(selectedRow); }}
          sx={{ color: '#e2e8f0', py: 1.4, fontSize: 13, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
          <VisibilityOutlinedIcon sx={{ mr: 1.5, fontSize: 17 }} /> Xem chi tiết
        </MenuItem>
        {(selectedRow?.status === 0 || selectedRow?.status === 1) && (
          <MenuItem 
            onClick={() => { setAnchorEl(null); if (selectedRow) openEdit(selectedRow); }}
            sx={{ color: '#e2e8f0', py: 1.4, fontSize: 13, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
            <EditOutlinedIcon sx={{ mr: 1.5, fontSize: 17 }} /> Chỉnh sửa
          </MenuItem>
        )}
        {selectedRow?.status === 2 && (
          <MenuItem onClick={() => { setAnchorEl(null); if (selectedRow?.id !== undefined) handleCancel(selectedRow.id); }}
            sx={{ color: '#f59e0b', py: 1.4, fontSize: 13, '&:hover': { bgcolor: 'rgba(245,158,11,0.07)' } }}>
            <CancelOutlinedIcon sx={{ mr: 1.5, fontSize: 17 }} /> Hủy phiếu
          </MenuItem>
        )}
        {selectedRow?.status === 0 && (
          <Box>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 0.5 }} />
            <MenuItem 
              onClick={() => { setAnchorEl(null); if (selectedRow?.id !== undefined) handleDelete(selectedRow.id); }}
              sx={{ color: '#ef4444', py: 1.4, fontSize: 13, '&:hover': { bgcolor: 'rgba(239,68,68,0.07)' } }}>
              <DeleteOutlineIcon sx={{ mr: 1.5, fontSize: 17 }} /> Xóa phiếu
            </MenuItem>
          </Box>
        )}
      </Menu>

      {/* ═══ FORM DIALOG — 2-column layout ══════════════════════════════ */}
      <Dialog open={Boolean(modalMode)} onClose={closeModal} maxWidth={false} fullWidth disableEnforceFocus
        PaperProps={{ sx: { bgcolor: '#0b1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, maxHeight: '96vh', width: '95vw', maxWidth: 1400 } }}>

        {/* ── Dialog Header ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,184,219,0.06)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(0,184,219,0.15)', color: '#00B8DB' }}>
              <InventoryOutlinedIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                {modalMode === 'add' ? 'Tạo phiếu xuất kho' : modalMode === 'view' ? 'Chi tiết phiếu xuất' : 'Chỉnh sửa phiếu xuất'}
              </Typography>
              {draft?.code && <Typography sx={{ color: '#475569', fontSize: 11 }}>{draft.code}</Typography>}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {draft?.status !== undefined && (
              <Chip label={getStatus(draft.status).label} size="small"
                sx={{ bgcolor: getStatus(draft.status).bg, color: getStatus(draft.status).color, fontWeight: 600, fontSize: 11, border: `1px solid ${getStatus(draft.status).color}30` }} />
            )}
            {!isReadOnly && (
              <Button onClick={() => handleSave(false)} variant="contained" size="small"
                sx={{ bgcolor: '#00B8DB', color: '#fff', textTransform: 'none', fontWeight: 600, px: 2.5, '&:hover': { bgcolor: '#00a3c4' } }}>
                {modalMode === 'add' ? 'Tạo phiếu' : 'Lưu thay đổi'}
              </Button>
            )}
            <IconButton onClick={closeModal} sx={{ color: '#64748b', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' } }}>
              <X size={18} />
            </IconButton>
          </Box>
        </Box>

        {/* ── Dialog Body: 2-column ── */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* ═══ LEFT: Goods detail table (3/4) ═══ */}
          <Box sx={{ flex: 3, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>

            {/* Picker bar */}
            {!isReadOnly && (
              <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(0,184,219,0.03)' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.8 }}>
                      Chọn danh mục hàng hoá để thêm
                    </Typography>
                    <SearchableSelect
                      size="small"
                      value={pickerCategoryId}
                      placeholder="Tìm và chọn danh mục..."
                      fetchOptions={fetchAssetCategoryOptions}
                      onChange={handlePickerCategoryChange}
                      clearable
                    />
                  </Box>
                  {/* Preview chip */}
                  {pickerCategoryMeta && (
                    <Box sx={{ display: 'flex', gap: 2.5, px: 2, py: 1, borderRadius: 1.5, bgcolor: 'rgba(0,184,219,0.06)', border: '1px solid rgba(0,184,219,0.2)', flexShrink: 0, alignItems: 'center' }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tồn kho</Typography>
                        <Typography sx={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}>{pickerCategoryMeta.currentQuantity ?? 0}</Typography>
                      </Box>
                      <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Giá nhập</Typography>
                        <Typography sx={{ color: '#00B8DB', fontSize: 14, fontWeight: 700 }}>{formatVND(pickerCategoryMeta.importPrice ?? 0)}</Typography>
                      </Box>
                    </Box>
                  )}
                  <Button variant="contained" startIcon={<AddBoxOutlinedIcon />} onClick={handleAddDetailRow}
                    sx={{ bgcolor: '#00B8DB', color: '#fff', textTransform: 'none', fontWeight: 600, height: 38, whiteSpace: 'nowrap', px: 2.5, '&:hover': { bgcolor: '#00a3c4' }, flexShrink: 0 }}>
                    Thêm vào phiếu
                  </Button>
                </Box>
              </Box>
            )}

            {/* Detail table */}
            <TableContainer sx={{ flex: 1, overflowY: 'auto', '&::-webkit-scrollbar': { width: 5 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.12)', borderRadius: 8 } }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {['#', 'Danh mục tài sản', 'Đơn vị', 'Số lượng', 'Đơn giá (VNĐ)', 'Thành tiền', ''].map((h, i) => (
                      <TableCell key={i} sx={{ bgcolor: '#0d1526', color: '#475569', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.07)', py: 1.5, whiteSpace: 'nowrap' }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(draft?.details || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 8, borderBottom: 'none' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                          <AddBoxOutlinedIcon sx={{ fontSize: 36, color: '#1e3a5f' }} />
                          <Typography sx={{ color: '#334155', fontSize: 13 }}>
                            {isReadOnly ? 'Không có hàng hoá nào' : 'Chọn danh mục ở trên và nhấn "Thêm vào phiếu"'}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (draft?.details || []).map((det, idx) => (
                    <TableRow key={idx} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.015)' } }}>
                      <TableCell sx={{ color: '#475569', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1, pl: 2, width: 36 }}>{idx + 1}</TableCell>
                      <TableCell sx={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1, fontSize: 13 }}>{det.assetCategoryName}</TableCell>
                      <TableCell sx={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1, fontSize: 13, minWidth: 80 }}>{det.unitName || det.unit || '—'}</TableCell>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1, minWidth: 80, maxWidth:100 }}>
                        {isReadOnly
                          ? <Typography sx={{ fontSize: 13, color: '#e2e8f0' }}>{det.quantity}</Typography>
                          : <CurrencyInput 
                              value={det.quantity} 
                              onChange={val => updateDetail(idx, { quantity: val })} 
                              suffix=""
                              max={100000}
                              style={{ height: 32, fontSize: 12, padding: '4px 8px' }}
                            />}
                      </TableCell>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1, minWidth: 150 }}>
                        {isReadOnly
                          ? <Typography sx={{ fontSize: 13, color: '#e2e8f0' }}>{det.unitPrice.toLocaleString('vi-VN')}</Typography>
                          : <CurrencyInput 
                              value={det.unitPrice} 
                              max={10000000000}
                              onChange={val => updateDetail(idx, { unitPrice: val })}
                              style={{ height: 32, fontSize: 12 }}
                            />}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#22c55e', fontWeight: 600, fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1, whiteSpace: 'nowrap' }}>
                        {formatVND(det.finalAmount)}
                      </TableCell>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1, pr: 1, width: 36 }}>
                        {!isReadOnly && (
                          <Tooltip title="Xóa dòng">
                            <IconButton size="small" onClick={() => removeDetailRow(idx)} sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}>
                              <RemoveCircleOutlineIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Totals bar at bottom of left panel */}
            <Box sx={{ px: 2.5, py: 2, borderTop: '1px solid rgba(255,255,255,0.07)', bgcolor: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'flex-end', gap: 4, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography sx={{ color: '#64748b', fontSize: 12 }}>Tiền hàng:</Typography>
                <Typography sx={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{formatVND(draft?.totalAmount ?? 0)}</Typography>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Typography sx={{ color: '#64748b', fontSize: 12 }}>Phí khác:</Typography>
                {isReadOnly
                  ? <Typography sx={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{formatVND(draft?.otherCosts ?? 0)}</Typography>
                  : <CurrencyInput 
                      value={draft?.otherCosts ?? 0} 
                      onChange={val => updateCost({ otherCosts: val })}
                      style={{ height: 32, width: 140, fontSize: 12 }}
                    />
                }
              </Box>

              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
                <Typography sx={{ color: '#94a3b8', fontSize: 12 }}>Tổng cộng:</Typography>
                <Typography sx={{ color: '#00B8DB', fontSize: 18, fontWeight: 700 }}>{formatVND(draft?.finalAmount ?? 0)}</Typography>
              </Box>
            </Box>
          </Box>

          {/* ═══ RIGHT: Info panel (1/4) ═══ */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: 8 } }}>

            {/* Section: Thông tin phiếu */}
            <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography sx={{ color: '#64748b', fontSize: 11, mb: 0.6 }}>Mã phiếu (Để trống để tự sinh)</Typography>
                  <input style={{ ...fieldStyle, opacity: isReadOnly ? 0.6 : 1 }} readOnly={isReadOnly}
                    placeholder="PX-YYYY-XXXX" value={draft?.code ?? ''}
                    onChange={e => setDraft(d => d ? { ...d, code: e.target.value } : d)} />
                </Box>
                <Box>
                  <Typography sx={{ color: '#64748b', fontSize: 11, mb: 0.6 }}>Loại xuất kho <span style={{ color: '#ef4444' }}>*</span></Typography>
                  <select style={{ ...fieldStyle, cursor: isReadOnly ? 'default' : 'pointer', opacity: isReadOnly ? 0.6 : 1 }}
                    disabled={isReadOnly} value={draft?.exportType ?? 1}
                    onChange={e => setDraft(d => d ? { ...d, exportType: Number(e.target.value) } : d)}>
                    <option value={1} style={{ background: '#0d1b2e' }}>Xuất sử dụng/Tiêu hao</option>
                    <option value={2} style={{ background: '#0d1b2e' }}>Xuất luân chuyển kho</option>
                  </select>
                </Box>
                <Box>
                  <Typography sx={{ color: '#64748b', fontSize: 11, mb: 0.6 }}>Kho xuất hàng <span style={{ color: '#ef4444' }}>*</span></Typography>
                  <SearchableSelect size="small" value={draft?.warehouseCategoryId || null}
                    placeholder="Chọn kho xuất..." fetchOptions={fetchWarehouseOptions}
                    disabled={isReadOnly} selectedLabel={draft?.warehouseCategoryName}
                    onChange={handleWarehouseChange} />
                </Box>
                
                {draft?.exportType === 2 ? (
                  <Box>
                    <Typography sx={{ color: '#64748b', fontSize: 11, mb: 0.6 }}>Kho nhận (Đích) <span style={{ color: '#ef4444' }}>*</span></Typography>
                    <SearchableSelect size="small" value={draft?.toWarehouseCategoryId || null}
                      placeholder="Chọn kho đích..." fetchOptions={fetchWarehouseOptions}
                      disabled={isReadOnly} selectedLabel={draft?.toWarehouseCategoryName}
                      onChange={val => setDraft(d => d ? { ...d, toWarehouseCategoryId: val ? Number(val) : null } : d)} />
                  </Box>
                ) : (
                  <Box>
                    <Typography sx={{ color: '#64748b', fontSize: 11, mb: 0.6 }}>Nơi nhận / Đơn vị sử dụng</Typography>
                    <input style={{ ...fieldStyle, opacity: isReadOnly ? 0.6 : 1 }} readOnly={isReadOnly}
                      placeholder="Phòng IT, Tầng 3..." value={draft?.exportDestination ?? ''}
                      onChange={e => setDraft(d => d ? { ...d, exportDestination: e.target.value } : d)} />
                  </Box>
                )}

                <Box>
                  <Typography sx={{ color: '#64748b', fontSize: 11, mb: 0.6 }}>Ngày xuất kho <span style={{ color: '#ef4444' }}>*</span></Typography>
                  <DateTimeInput style={fieldStyle} readOnly={isReadOnly} value={draft?.exportDate}
                    onChange={val => setDraft(d => d ? { ...d, exportDate: val ?? '' } : d)} />
                </Box>
                <Box>
                  <Typography sx={{ color: '#64748b', fontSize: 11, mb: 0.6 }}>Trạng thái</Typography>
                  <select style={{ ...fieldStyle, cursor: isReadOnly ? 'default' : 'pointer', opacity: isReadOnly ? 0.6 : 1 }}
                    disabled={isReadOnly} value={draft?.status ?? 0}
                    onChange={e => setDraft(d => d ? { ...d, status: Number(e.target.value) } : d)}>
                    {STATUSES.filter(s => isReadOnly || s.value <= 1).map(s => <option key={s.value} value={s.value} style={{ background: '#0d1b2e' }}>{s.label}</option>)}
                  </select>
                </Box>
                <Box>
                  <Typography sx={{ color: '#64748b', fontSize: 11, mb: 0.6 }}>
                    Lý do xuất <span style={{ color: '#ef4444' }}>*</span>
                  </Typography>
                  <textarea rows={3} style={{ ...fieldStyle, height: 'auto', resize: 'none', lineHeight: 1.5, opacity: isReadOnly ? 0.6 : 1,
                    borderColor: !isReadOnly && !draft?.reason?.trim() ? 'rgba(239,68,68,0.6)' : undefined }}
                    readOnly={isReadOnly} placeholder="Mua sắm thiết bị, bổ sung vật tư..."
                    value={draft?.reason ?? ''}
                    onChange={e => setDraft(d => d ? { ...d, reason: e.target.value } : d)} />
                </Box>
              </Box>
            </Box>

            {/* Section: Nhân sự */}
            <Box sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography sx={{ color: '#64748b', fontSize: 11, mb: 0.6 }}>Người nhận hàng</Typography>
                  <input style={{ ...fieldStyle, opacity: isReadOnly ? 0.6 : 1 }} readOnly={isReadOnly}
                    placeholder="Tên người nhận..." value={draft?.receiver ?? ''}
                    onChange={e => setDraft(d => d ? { ...d, receiver: e.target.value } : d)} />
                </Box>
                <Box>
                  <Typography sx={{ color: '#64748b', fontSize: 11, mb: 0.6 }}>Người lập phiếu</Typography>
                  <SearchableSelect size="small" value={draft?.creatorId ?? null} placeholder="Tìm và chọn..."
                    fetchOptions={fetchUserOptions} disabled={isReadOnly} selectedLabel={draft?.creatorName}
                    onChange={val => setDraft(d => d ? { ...d, creatorId: val ? Number(val) : null } : d)} />
                </Box>
                <Box>
                  <Typography sx={{ color: '#64748b', fontSize: 11, mb: 0.6 }}>Kế toán</Typography>
                  <SearchableSelect size="small" value={draft?.accountantId ?? null} placeholder="Tìm và chọn..."
                    fetchOptions={fetchUserOptions} disabled={isReadOnly} selectedLabel={draft?.accountantName}
                    onChange={val => setDraft(d => d ? { ...d, accountantId: val ? Number(val) : null } : d)} />
                </Box>
                <Box>
                  <Typography sx={{ color: '#64748b', fontSize: 11, mb: 0.6 }}>
                    Thủ kho
                    {draft?.warehouseCategoryId ? (
                      <span style={{ color: '#00B8DB', fontSize: 10, marginLeft: 6 }}>(tự động từ kho)</span>
                    ) : null}
                  </Typography>
                  <SearchableSelect size="small" value={draft?.storekeeperId ?? null} placeholder="Tìm và chọn..."
                    fetchOptions={fetchUserOptions} disabled={isReadOnly} selectedLabel={draft?.storekeeperName}
                    onChange={val => setDraft(d => d ? { ...d, storekeeperId: val ? Number(val) : null } : d)} />
                </Box>
              </Box>
            </Box>

            {/* Footer actions (inside right panel) */}
            {!isReadOnly && (
              <Box sx={{ mt: 'auto', px: 2.5, py: 2, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(modalMode === 'edit' || modalMode === 'add') && draft?.status === 0 && (
                  <Button fullWidth variant="outlined" startIcon={<CheckCircleOutlineIcon />}
                    onClick={() => handleSave(true)}
                    sx={{ color: '#22c55e', borderColor: 'rgba(34,197,94,0.35)', textTransform: 'none', '&:hover': { borderColor: '#22c55e', bgcolor: 'rgba(34,197,94,0.07)' } }}>
                    Gửi phê duyệt
                  </Button>
                )}
                <Button fullWidth onClick={closeModal}
                  sx={{ color: '#64748b', textTransform: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
                  Huỷ bỏ
                </Button>
              </Box>
            )}
            {isReadOnly && (
              <Box sx={{ mt: 'auto', px: 2.5, py: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <Button fullWidth onClick={closeModal}
                  sx={{ color: '#64748b', textTransform: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
                  Đóng
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
};
