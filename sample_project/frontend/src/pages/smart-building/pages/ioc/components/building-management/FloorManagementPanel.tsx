import SearchIcon from '@mui/icons-material/Search';
import {
  Box, Button, Chip, Dialog, FormControl, IconButton, InputAdornment,
  MenuItem, Select, TextField, Tooltip, Typography,
} from '@mui/material';
import { motion } from 'framer-motion';
import { Edit2, Eye, Save, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';

import buildingService, { type Building } from '@/services/urban/building.service';
import floorService, { type Floor, type FloorType } from '@/services/urban/floor.service';

const fieldStyle = {
  width: '100%', boxSizing: 'border-box' as const, padding: '12px 16px',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
};
const selectSx = {
  color: '#f1f5f9', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00B8DB' },
  '& .MuiSelect-icon': { color: '#94a3b8' },
};

const FLOOR_TYPES: { value: FloorType; label: string; color: string }[] = [
  { value: 'BASEMENT', label: 'Hầm', color: '#94a3b8' },
  { value: 'GROUND', label: 'Tầng trệt', color: '#22c55e' },
  { value: 'OFFICE', label: 'Văn phòng', color: '#3b82f6' },
  { value: 'COMMERCIAL', label: 'Thương mại', color: '#f59e0b' },
  { value: 'MECHANICAL', label: 'Kỹ thuật', color: '#ef4444' },
  { value: 'ROOFTOP', label: 'Sân thượng', color: '#8b5cf6' },
  { value: 'PARKING', label: 'Bãi xe', color: '#06b6d4' },
];

const FloorManagementPanel = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [floors, setFloors] = useState<Floor[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [filterBuildingId, setFilterBuildingId] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [modalMode, setModalMode] = useState<'edit' | 'view' | null>(null);
  const [draft, setDraft] = useState<Partial<Floor> | null>(null);

  useEffect(() => {
    buildingService.getBuildings().then((d: any) => setBuildings(Array.isArray(d) ? d : d?.items || [])).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    floorService.getFloors(filterBuildingId || undefined)
      .then((data: any) => setFloors(Array.isArray(data) ? data : data?.items || []))
      .catch(() => enqueueSnackbar('Lỗi tải dữ liệu', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [refreshTrigger, filterBuildingId]);

  const filtered = floors.filter((f) =>
    (f.name || '').toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async () => {
    if (!draft?.name || !draft?.buildingId || draft?.floorNumber === undefined) {
      enqueueSnackbar('Vui lòng nhập đầy đủ thông tin', { variant: 'warning' });
      return;
    }
    try {
      if (modalMode === 'edit' && draft.id) {
        await floorService.updateFloor(draft.id, draft);
        enqueueSnackbar('Cập nhật thành công', { variant: 'success' });
      }
      setModalMode(null); setDraft(null); setRefreshTrigger((p) => p + 1);
    } catch { enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' }); }
  };

  const getFloorTypeInfo = (t?: string) => FLOOR_TYPES.find((ft) => ft.value === t) || { label: t || '—', color: '#94a3b8' };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }} style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'auto' }}>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>Quản lý Tầng</Typography>
        <Typography sx={{ color: '#64748b', fontSize: 12, fontStyle: 'italic' }}>
          Tầng được tự động bóc tách từ model 3D khi thêm tòa nhà
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
        <TextField fullWidth placeholder="Tìm kiếm tầng..." value={search} onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, '& .MuiOutlinedInput-root': { color: '#fff', bgcolor: 'rgba(15,23,42,0.4)', borderRadius: 2, height: 46, '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&.Mui-focused fieldset': { borderColor: '#00B8DB' } }, '& .MuiInputBase-input::placeholder': { color: '#9ca3af', opacity: 1 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#9ca3af', fontSize: 20 }} /></InputAdornment> }}
        />
        <FormControl sx={{ minWidth: 220 }}>
          <Select displayEmpty value={filterBuildingId} onChange={(e) => setFilterBuildingId(e.target.value as number | '')} sx={{ ...selectSx, height: 46 }}>
            <MenuItem value="">Tất cả tòa nhà</MenuItem>
            {buildings.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ flex: 1, bgcolor: 'rgba(15,23,42,0.6)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', overflow: 'auto', backdropFilter: 'blur(16px)' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { px: 2, py: 1.5, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#e2e8f0', fontSize: 13 }, '& th': { color: '#94a3b8', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 } }}>
          <thead><tr><th>#</th><th>Tầng</th><th>Tên</th><th>Loại</th><th>Tòa nhà</th><th>Thiết bị</th><th>Cao độ</th><th style={{ textAlign: 'right' }}>Thao tác</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Đang tải...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Không có dữ liệu</td></tr>}
            {filtered.map((f, i) => {
              const ft = getFloorTypeInfo(f.floorType);
              return (
                <tr key={f.id} style={{ transition: 'background 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td>{i + 1}</td>
                  <td><Chip label={f.floorNumber} size="small" sx={{ bgcolor: 'rgba(0,184,219,0.15)', color: '#00B8DB', fontWeight: 700, minWidth: 36 }} /></td>
                  <td style={{ fontWeight: 600 }}>{f.name}</td>
                  <td><Chip label={ft.label} size="small" sx={{ bgcolor: `${ft.color}20`, color: ft.color, fontSize: 11 }} /></td>
                  <td>{f.building?.name || buildings.find((b) => b.id === f.buildingId)?.name || '—'}</td>
                  <td>{f._count?.devices ?? 0}</td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{f.elevation != null ? `${f.elevation}m` : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Tooltip title="Xem"><IconButton size="small" onClick={() => { setDraft(f); setModalMode('view'); }} sx={{ color: '#94a3b8', '&:hover': { color: '#00B8DB' } }}><Eye size={16} /></IconButton></Tooltip>
                      <Tooltip title="Sửa"><IconButton size="small" onClick={() => { setDraft(f); setModalMode('edit'); }} sx={{ color: '#94a3b8', '&:hover': { color: '#fbbf24' } }}><Edit2 size={16} /></IconButton></Tooltip>
                    </Box>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Box>
      </Box>

      <Dialog open={!!modalMode} onClose={() => { setModalMode(null); setDraft(null); }} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#0d1b2e', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 3, boxShadow: '0 25px 60px rgba(0,0,0,0.8)' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 3, pb: 2 }}>
          <Typography sx={{ color: '#00e5ff', fontWeight: 700, fontSize: 18 }}>
            {modalMode === 'edit' ? 'Chỉnh sửa' : 'Chi tiết'} Tầng
          </Typography>
          <Box component="button" onClick={() => { setModalMode(null); setDraft(null); }} sx={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', p: 0.5 }}><X size={20} /></Box>
        </Box>
        <Box sx={{ px: 3, pb: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Tòa nhà <span style={{ color: '#ef4444' }}>*</span></Typography>
            <FormControl fullWidth>
              <Select value={draft?.buildingId ?? ''} disabled={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, buildingId: e.target.value as number } : d)} sx={selectSx}>
                {buildings.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Số tầng <span style={{ color: '#ef4444' }}>*</span></Typography>
              <input type="number" style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.floorNumber ?? 0} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, floorNumber: parseInt(e.target.value) } : d)} />
            </Box>
            <Box sx={{ flex: 2 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Tên <span style={{ color: '#ef4444' }}>*</span></Typography>
              <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.name ?? ''} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, name: e.target.value } : d)} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Loại tầng</Typography>
              <FormControl fullWidth>
                <Select value={draft?.floorType ?? 'OFFICE'} disabled={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, floorType: e.target.value as FloorType } : d)} sx={selectSx}>
                  {FLOOR_TYPES.map((ft) => <MenuItem key={ft.value} value={ft.value}>{ft.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Chiều cao (m)</Typography>
              <input type="number" step="0.1" style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.height ?? 3.5} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, height: parseFloat(e.target.value) } : d)} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Cao độ (m)</Typography>
              <input type="number" step="0.1" style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.elevation ?? 0} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, elevation: parseFloat(e.target.value) } : d)} />
            </Box>
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

export default FloorManagementPanel;
