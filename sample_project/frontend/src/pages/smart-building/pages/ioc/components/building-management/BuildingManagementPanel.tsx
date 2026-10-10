import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Chip,
  Dialog,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  Alert,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { Edit2, Eye, Layers, Save, Trash2, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';

import buildingService, { type Building } from '@/services/urban/building.service';
import urbanService, { type Urban } from '@/services/urban/urban.service';

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '12px 16px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s',
};

const selectSx = {
  color: '#f1f5f9',
  bgcolor: 'rgba(255,255,255,0.05)',
  borderRadius: 2,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00B8DB' },
  '& .MuiSelect-icon': { color: '#94a3b8' },
};

const BuildingManagementPanel = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [urbans, setUrbans] = useState<Urban[]>([]);
  const [search, setSearch] = useState('');
  const [filterUrbanId, setFilterUrbanId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [draft, setDraft] = useState<Partial<Building> | null>(null);

  useEffect(() => {
    urbanService.getAllUrban().then((d) => setUrbans(Array.isArray(d) ? d : [])).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    buildingService
      .getBuildings(filterUrbanId || undefined)
      .then((data: any) => setBuildings(Array.isArray(data) ? data : data?.items || []))
      .catch(() => enqueueSnackbar('Lỗi tải dữ liệu', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [refreshTrigger, filterUrbanId]);

  const filtered = buildings.filter(
    (b) =>
      (b.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.code || '').toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async () => {
    if (!draft?.name || !draft?.urbanId) {
      enqueueSnackbar('Vui lòng nhập tên và chọn khu đô thị', { variant: 'warning' });
      return;
    }
    try {
      if (modalMode === 'add') {
        const res = await buildingService.createBuilding(draft as any);
        if (res.validation && !res.validation.valid) {
          enqueueSnackbar(`Lỗi GLB: ${res.validation.errors.join(', ')}`, { variant: 'error', autoHideDuration: 10000 });
          return;
        }
        if (res.validation?.warnings?.length) {
          enqueueSnackbar(`Tạo thành công, nhưng có cảnh báo GLB: ${res.validation.warnings.join(', ')}`, { variant: 'warning', autoHideDuration: 8000 });
        } else {
          enqueueSnackbar(res.message || 'Thêm mới thành công', { variant: 'success' });
        }
      } else if (modalMode === 'edit' && draft.id) {
        await buildingService.updateBuilding(draft.id, draft);
        enqueueSnackbar('Cập nhật thành công', { variant: 'success' });
      }
      setModalMode(null);
      setDraft(null);
      setRefreshTrigger((p) => p + 1);
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.message || 'Có lỗi xảy ra', { variant: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa tòa nhà này? Tất cả tầng và thiết bị bên trong cũng sẽ bị xóa.')) return;
    try {
      await buildingService.deleteBuilding(id);
      enqueueSnackbar('Xóa thành công', { variant: 'success' });
      setRefreshTrigger((p) => p + 1);
    } catch {
      enqueueSnackbar('Lỗi khi xóa', { variant: 'error' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'auto' }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>Quản lý Tòa nhà</Typography>
        <Button onClick={() => { setDraft({ code: '', name: '', urbanId: urbans[0]?.id, totalFloors: 1 }); setModalMode('add'); }}
          variant="contained" startIcon={<AddIcon />}
          sx={{ bgcolor: '#00B8DB', color: '#fff', fontWeight: 600, textTransform: 'none', borderRadius: 2, px: 3, py: 1, boxShadow: 'none', '&:hover': { bgcolor: '#0097B5' } }}>
          Thêm mới
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
        <TextField fullWidth placeholder="Tìm kiếm tòa nhà..." value={search} onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, '& .MuiOutlinedInput-root': { color: '#fff', bgcolor: 'rgba(15,23,42,0.4)', borderRadius: 2, height: 46, '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&.Mui-focused fieldset': { borderColor: '#00B8DB' } }, '& .MuiInputBase-input::placeholder': { color: '#9ca3af', opacity: 1 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#9ca3af', fontSize: 20 }} /></InputAdornment> }}
        />
        <FormControl sx={{ minWidth: 200 }}>
          <Select displayEmpty value={filterUrbanId} onChange={(e) => setFilterUrbanId(e.target.value as number | '')}
            sx={{ ...selectSx, height: 46 }}>
            <MenuItem value="">Tất cả khu đô thị</MenuItem>
            {urbans.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ flex: 1, bgcolor: 'rgba(15,23,42,0.6)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', overflow: 'auto', backdropFilter: 'blur(16px)' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { px: 2, py: 1.5, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#e2e8f0', fontSize: 13 }, '& th': { color: '#94a3b8', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 } }}>
          <thead><tr><th>#</th><th>Mã</th><th>Tên</th><th>Slug</th><th>Khu đô thị</th><th>Số tầng</th><th style={{ textAlign: 'right' }}>Thao tác</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Đang tải...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Không có dữ liệu</td></tr>}
            {filtered.map((b, i) => (
              <tr key={b.id} style={{ transition: 'background 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td>{i + 1}</td>
                <td><Chip label={b.code || '—'} size="small" sx={{ bgcolor: 'rgba(0,184,219,0.15)', color: '#00B8DB', fontWeight: 600, fontSize: 11 }} /></td>
                <td style={{ fontWeight: 600 }}>{b.name}</td>
                <td style={{ color: '#64748b', fontSize: 12 }}>{b.slug}</td>
                <td><Chip label={b.urban?.name || '—'} size="small" sx={{ bgcolor: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontSize: 11 }} /></td>
                <td><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#94a3b8' }}><Layers size={12} /> {b.totalFloors}</Box></td>
                <td style={{ textAlign: 'right' }}>
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                    <Tooltip title="Xem"><IconButton size="small" onClick={() => { setDraft(b); setModalMode('view'); }} sx={{ color: '#94a3b8', '&:hover': { color: '#00B8DB' } }}><Eye size={16} /></IconButton></Tooltip>
                    <Tooltip title="Sửa"><IconButton size="small" onClick={() => { setDraft(b); setModalMode('edit'); }} sx={{ color: '#94a3b8', '&:hover': { color: '#fbbf24' } }}><Edit2 size={16} /></IconButton></Tooltip>
                    <Tooltip title="Xóa"><IconButton size="small" onClick={() => handleDelete(b.id)} sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}><Trash2 size={16} /></IconButton></Tooltip>
                  </Box>
                </td>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>

      {/* Modal */}
      <Dialog open={!!modalMode} onClose={() => { setModalMode(null); setDraft(null); }} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#0d1b2e', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 3, boxShadow: '0 25px 60px rgba(0,0,0,0.8)' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 3, pb: 2 }}>
          <Typography sx={{ color: '#00e5ff', fontWeight: 700, fontSize: 18 }}>
            {modalMode === 'add' ? 'Thêm mới' : modalMode === 'edit' ? 'Chỉnh sửa' : 'Chi tiết'} Tòa nhà
          </Typography>
          <Box component="button" onClick={() => { setModalMode(null); setDraft(null); }} sx={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', p: 0.5 }}><X size={20} /></Box>
        </Box>
        <Box sx={{ px: 3, pb: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Khu đô thị <span style={{ color: '#ef4444' }}>*</span></Typography>
            <FormControl fullWidth>
              <Select value={draft?.urbanId ?? ''} disabled={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, urbanId: e.target.value as number } : d)} sx={selectSx}>
                {urbans.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Mã</Typography>
              <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.code ?? ''} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, code: e.target.value } : d)} />
            </Box>
            <Box sx={{ flex: 2 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Tên <span style={{ color: '#ef4444' }}>*</span></Typography>
              <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.name ?? ''} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, name: e.target.value } : d)} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Số tầng</Typography>
              <input type="number" style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.totalFloors ?? 1} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, totalFloors: parseInt(e.target.value) || 1 } : d)} />
            </Box>
            <Box sx={{ flex: 2 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Địa chỉ</Typography>
              <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.address ?? ''} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, address: e.target.value } : d)} />
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Tọa độ X</Typography>
              <input type="number" step="0.1" style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.positionX ?? 0} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, positionX: parseFloat(e.target.value) || 0 } : d)} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Tọa độ Y</Typography>
              <input type="number" step="0.1" style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.positionY ?? 0} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, positionY: parseFloat(e.target.value) || 0 } : d)} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Tọa độ Z</Typography>
              <input type="number" step="0.1" style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.positionZ ?? 0} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, positionZ: parseFloat(e.target.value) || 0 } : d)} />
            </Box>
          </Box>

          {modalMode === 'add' && (
            <Box>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Mô hình 3D (.glb)</Typography>
              <Box sx={{ border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 2, p: 2, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)' }}>
                <input
                  type="file"
                  accept=".glb"
                  id="glb-upload"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setDraft((d) => d ? { ...d, modelFile: file } as any : d);
                  }}
                />
                <label htmlFor="glb-upload">
                  <Button component="span" startIcon={<CloudUpload />} sx={{ color: '#00B8DB', textTransform: 'none' }}>
                    {(draft as any)?.modelFile?.name || 'Chọn file .glb (Tối đa 50MB)'}
                  </Button>
                </label>
                {!(draft as any)?.modelFile && (
                  <Typography sx={{ color: '#64748b', fontSize: 12, mt: 1 }}>
                    Hệ thống sẽ tự động phân tích và tạo tầng nếu có file
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Mô tả</Typography>
            <textarea style={{ ...fieldStyle, minHeight: 80, resize: 'vertical', opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.description ?? ''} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, description: e.target.value } : d)} />
          </Box>
          {modalMode !== 'view' && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 1 }}>
              <Button onClick={() => { setModalMode(null); setDraft(null); }} sx={{ color: '#94a3b8', textTransform: 'none' }}>Hủy</Button>
              <Button onClick={handleSave} variant="contained" startIcon={<Save size={16} />} sx={{ bgcolor: '#00B8DB', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#0097B5' } }}>Lưu</Button>
            </Box>
          )}
        </Box>
      </Dialog>
    </motion.div>
  );
};

export default BuildingManagementPanel;
