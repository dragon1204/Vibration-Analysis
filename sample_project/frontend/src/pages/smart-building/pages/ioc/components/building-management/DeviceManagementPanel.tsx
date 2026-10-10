import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box, Button, Chip, Dialog, FormControl, IconButton, InputAdornment,
  MenuItem, Select, TextField, Tooltip, Typography,
} from '@mui/material';
import { motion } from 'framer-motion';
import { Edit2, Eye, Save, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';

import type { IDevice } from '@/services/building-device/device.model';
import deviceService from '@/services/building-device/device.service';
import buildingService, { type Building } from '@/services/urban/building.service';
import floorService, { type Floor } from '@/services/urban/floor.service';
import { MapPin, ArrowUpDown } from 'lucide-react';
import { DevicePlacementXY } from './DevicePlacementXY';
import { DevicePlacementZ } from './DevicePlacementZ';

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

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22c55e', INACTIVE: '#94a3b8', MAINTENANCE: '#f59e0b', OFFLINE: '#ef4444', ERROR: '#dc2626',
};

const DeviceManagementPanel = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [devices, setDevices] = useState<IDevice[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [filterBuildingId, setFilterBuildingId] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [draft, setDraft] = useState<Partial<IDevice> | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [placementXYOpen, setPlacementXYOpen] = useState(false);
  const [placementZOpen, setPlacementZOpen] = useState(false);

  useEffect(() => {
    buildingService.getBuildings().then((d: any) => setBuildings(Array.isArray(d) ? d : d?.items || [])).catch(console.error);
  }, []);

  useEffect(() => {
    if (draft?.buildingId) {
      floorService.getFloors(draft.buildingId).then((d: any) => {
        const floorItems = Array.isArray(d) ? d : (d?.items || []);
        // Tầng xếp theo floorNumber
        floorItems.sort((a: any, b: any) => (a.floorNumber || 0) - (b.floorNumber || 0));
        setFloors(floorItems);
      }).catch(console.error);
    } else {
      setFloors([]);
    }
  }, [draft?.buildingId]);

  useEffect(() => {
    setLoading(true);
    const params: any = { take: 200 };
    if (filterBuildingId) params.buildingId = filterBuildingId;
    if (search) params.search = search;
    deviceService.getDevices(params)
      .then((data: any) => setDevices(data?.items || (Array.isArray(data) ? data : [])))
      .catch(() => enqueueSnackbar('Lỗi tải dữ liệu', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [refreshTrigger, filterBuildingId, search]);

  const handleSave = async () => {
    if (!draft?.name || !draft?.type || !draft?.buildingId) {
      enqueueSnackbar('Vui lòng nhập đầy đủ thông tin', { variant: 'warning' });
      return;
    }
    try {
      if (modalMode === 'add') {
        await deviceService.createDevice(draft);
        enqueueSnackbar('Thêm mới thành công', { variant: 'success' });
      } else if (modalMode === 'edit' && draft.id) {
        await deviceService.updateDevice(draft.id, draft);
        enqueueSnackbar('Cập nhật thành công', { variant: 'success' });
      }
      setModalMode(null); setDraft(null); setRefreshTrigger((p) => p + 1);
    } catch { enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' }); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa thiết bị này?')) return;
    try {
      await deviceService.deleteDevice(id);
      enqueueSnackbar('Xóa thành công', { variant: 'success' });
      setRefreshTrigger((p) => p + 1);
    } catch { enqueueSnackbar('Lỗi khi xóa', { variant: 'error' }); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }} style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'auto' }}>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>Quản lý Thiết bị</Typography>
        <Button onClick={() => { setDraft({ deviceId: '', name: '', type: 'OTHER', buildingId: buildings[0]?.id, status: 'ACTIVE', isOnline: true }); setModalMode('add'); }}
          variant="contained" startIcon={<AddIcon />}
          sx={{ bgcolor: '#00B8DB', color: '#fff', fontWeight: 600, textTransform: 'none', borderRadius: 2, px: 3, py: 1, boxShadow: 'none', '&:hover': { bgcolor: '#0097B5' } }}>
          Thêm mới
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
        <TextField fullWidth placeholder="Tìm kiếm thiết bị..." value={search} onChange={(e) => setSearch(e.target.value)}
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
          <thead><tr><th>#</th><th>DeviceID</th><th>Tên</th><th>Loại</th><th>Trạng thái</th><th>Online</th><th style={{ textAlign: 'right' }}>Thao tác</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Đang tải...</td></tr>}
            {!loading && devices.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Không có dữ liệu</td></tr>}
            {devices.map((d, i) => (
              <tr key={d.id} style={{ transition: 'background 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td>{i + 1}</td>
                <td><Chip label={d.deviceId || '—'} size="small" sx={{ bgcolor: 'rgba(0,184,219,0.15)', color: '#00B8DB', fontWeight: 600, fontSize: 11 }} /></td>
                <td style={{ fontWeight: 600 }}>{d.name}</td>
                <td><Chip label={d.type} size="small" sx={{ bgcolor: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontSize: 10 }} /></td>
                <td><Chip label={d.status || 'N/A'} size="small" sx={{ bgcolor: `${STATUS_COLORS[d.status || ''] || '#94a3b8'}20`, color: STATUS_COLORS[d.status || ''] || '#94a3b8', fontSize: 11 }} /></td>
                <td>{d.isOnline ? <Wifi size={16} color="#22c55e" /> : <WifiOff size={16} color="#ef4444" />}</td>
                <td style={{ textAlign: 'right' }}>
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                    <Tooltip title="Xem"><IconButton size="small" onClick={() => { setDraft(d); setModalMode('view'); }} sx={{ color: '#94a3b8', '&:hover': { color: '#00B8DB' } }}><Eye size={16} /></IconButton></Tooltip>
                    <Tooltip title="Sửa"><IconButton size="small" onClick={() => { setDraft(d); setModalMode('edit'); }} sx={{ color: '#94a3b8', '&:hover': { color: '#fbbf24' } }}><Edit2 size={16} /></IconButton></Tooltip>
                    <Tooltip title="Xóa"><IconButton size="small" onClick={() => handleDelete(d.id)} sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}><Trash2 size={16} /></IconButton></Tooltip>
                  </Box>
                </td>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>

      <Dialog open={!!modalMode} onClose={() => { setModalMode(null); setDraft(null); }} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#0d1b2e', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 3, boxShadow: '0 25px 60px rgba(0,0,0,0.8)' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 3, pb: 2 }}>
          <Typography sx={{ color: '#00e5ff', fontWeight: 700, fontSize: 18 }}>
            {modalMode === 'add' ? 'Thêm mới' : modalMode === 'edit' ? 'Chỉnh sửa' : 'Chi tiết'} Thiết bị
          </Typography>
          <Box component="button" onClick={() => { setModalMode(null); setDraft(null); }} sx={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', p: 0.5 }}><X size={20} /></Box>
        </Box>
        <Box sx={{ px: 3, pb: 3, display: 'flex', flexDirection: 'column', gap: 2.5, maxHeight: '60vh', overflowY: 'auto' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Tòa nhà <span style={{ color: '#ef4444' }}>*</span></Typography>
              <FormControl fullWidth>
                <Select value={draft?.buildingId ?? ''} disabled={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, buildingId: e.target.value as number, floorId: undefined } as any : d)} sx={selectSx}>
                  {buildings.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Tầng <span style={{ color: '#ef4444' }}>*</span></Typography>
              <FormControl fullWidth>
                <Select value={draft?.floorId ?? ''} disabled={modalMode === 'view' || !draft?.buildingId} onChange={(e) => setDraft((d) => d ? { ...d, floorId: e.target.value as number } : d)} sx={selectSx}>
                  {floors.map((f) => <MenuItem key={f.id} value={f.id}>{f.name} (Tầng {f.floorNumber})</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Device ID (Cục bộ)</Typography>
              <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.deviceId ?? ''} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, deviceId: e.target.value } : d)} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>EBO ID (Kết nối thật)</Typography>
              <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={(draft as any)?.eboId ?? ''} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, eboId: e.target.value } : d)} />
            </Box>
            <Box sx={{ flex: 2 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Tên <span style={{ color: '#ef4444' }}>*</span></Typography>
              <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.name ?? ''} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, name: e.target.value } : d)} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Loại thiết bị <span style={{ color: '#ef4444' }}>*</span></Typography>
              <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.type ?? ''} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, type: e.target.value as any } : d)} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Trạng thái</Typography>
              <FormControl fullWidth>
                <Select value={draft?.status ?? 'ACTIVE'} disabled={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, status: e.target.value as any } : d)} sx={selectSx}>
                  {['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OFFLINE', 'ERROR'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
          </Box>
          
          {modalMode !== 'view' && (
            <Box sx={{ mt: 1, p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 2 }}>
              <Typography sx={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, mb: 2 }}>Vị trí 3D</Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: '#94a3b8', fontSize: 12, mb: 1 }}>Tọa độ X</Typography>
                  <input type="number" step="0.1" style={{ ...fieldStyle, py: 1 }} value={draft?.xCoordinate ?? 0} onChange={(e) => setDraft((d) => d ? { ...d, xCoordinate: parseFloat(e.target.value) || 0 } : d)} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: '#94a3b8', fontSize: 12, mb: 1 }}>Tọa độ Y</Typography>
                  <input type="number" step="0.1" style={{ ...fieldStyle, py: 1 }} value={draft?.yCoordinate ?? 0} onChange={(e) => setDraft((d) => d ? { ...d, yCoordinate: parseFloat(e.target.value) || 0 } : d)} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: '#94a3b8', fontSize: 12, mb: 1 }}>Độ cao (Z)</Typography>
                  <input type="number" step="0.1" style={{ ...fieldStyle, py: 1 }} value={draft?.zCoordinate ?? 0} onChange={(e) => setDraft((d) => d ? { ...d, zCoordinate: parseFloat(e.target.value) || 0 } : d)} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button variant="outlined" startIcon={<MapPin size={16} />} sx={{ flex: 1, color: '#00B8DB', borderColor: 'rgba(0,184,219,0.5)', textTransform: 'none', '&:hover': { borderColor: '#00B8DB', bgcolor: 'rgba(0,184,219,0.1)' } }}
                  onClick={() => {
                    if (!draft?.buildingId || !draft?.floorId) {
                      enqueueSnackbar('Vui lòng chọn tòa nhà và tầng trước', { variant: 'warning' });
                      return;
                    }
                    setPlacementXYOpen(true);
                  }}>
                  Đặt vị trí trên mặt bằng
                </Button>
                <Button variant="outlined" startIcon={<ArrowUpDown size={16} />} sx={{ flex: 1, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.5)', textTransform: 'none', '&:hover': { borderColor: '#a78bfa', bgcolor: 'rgba(167,139,250,0.1)' } }}
                  onClick={() => {
                    if (!draft?.buildingId || !draft?.floorId) {
                      enqueueSnackbar('Vui lòng chọn tòa nhà và tầng trước', { variant: 'warning' });
                      return;
                    }
                    setPlacementZOpen(true);
                  }}>
                  Đặt độ cao
                </Button>
              </Box>
            </Box>
          )}
          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Mô tả</Typography>
            <textarea style={{ ...fieldStyle, minHeight: 60, resize: 'vertical', opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.description ?? ''} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, description: e.target.value } : d)} />
          </Box>
          {modalMode !== 'view' && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 1 }}>
              <Button onClick={() => { setModalMode(null); setDraft(null); }} sx={{ color: '#94a3b8', textTransform: 'none' }}>Hủy</Button>
              <Button onClick={handleSave} variant="contained" startIcon={<Save size={16} />} sx={{ bgcolor: '#00B8DB', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#0097B5' } }}>Lưu</Button>
            </Box>
          )}
        </Box>
      </Dialog>

      {/* UX Placement Dialogs */}
      {placementXYOpen && draft?.buildingId && draft?.floorId && (
        <DevicePlacementXY
          open={placementXYOpen}
          onClose={() => setPlacementXYOpen(false)}
          buildingId={draft.buildingId}
          floorName={floors.find(f => f.id === draft.floorId)?.name || ''}
          initialX={draft.xCoordinate || 0}
          initialY={draft.yCoordinate || 0}
          onSave={(x, y) => {
            setDraft(d => d ? { ...d, xCoordinate: x, yCoordinate: y } : d);
            setPlacementXYOpen(false);
          }}
        />
      )}

      {placementZOpen && draft?.buildingId && draft?.floorId && (
        <DevicePlacementZ
          open={placementZOpen}
          onClose={() => setPlacementZOpen(false)}
          buildingId={draft.buildingId}
          floorName={floors.find(f => f.id === draft.floorId)?.name || ''}
          floorHeight={floors.find(f => f.id === draft.floorId)?.height || 3.5}
          deviceType={draft.type || ''}
          initialZ={draft.zCoordinate || 0}
          onSave={(z) => {
            setDraft(d => d ? { ...d, zCoordinate: z } : d);
            setPlacementZOpen(false);
          }}
        />
      )}
    </motion.div>
  );
};

export default DeviceManagementPanel;
