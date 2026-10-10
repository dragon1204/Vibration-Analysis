import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { motion } from 'framer-motion';
import { Edit2, Eye, MapPin, Save, Trash2, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';

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

const UrbanManagementPanel = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [urbans, setUrbans] = useState<Urban[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [draft, setDraft] = useState<Partial<Urban> | null>(null);

  useEffect(() => {
    setLoading(true);
    urbanService
      .getAllUrban()
      .then((data) => setUrbans(Array.isArray(data) ? data : []))
      .catch(() => enqueueSnackbar('Lỗi tải dữ liệu', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  const filtered = urbans.filter(
    (u) =>
      (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.code || '').toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async () => {
    if (!draft?.name) {
      enqueueSnackbar('Vui lòng nhập tên khu đô thị', { variant: 'warning' });
      return;
    }
    try {
      if (modalMode === 'add') {
        await urbanService.createUrban(draft);
        enqueueSnackbar('Thêm mới thành công', { variant: 'success' });
      } else if (modalMode === 'edit' && draft.id) {
        await urbanService.updateUrban(draft.id, draft);
        enqueueSnackbar('Cập nhật thành công', { variant: 'success' });
      }
      setModalMode(null);
      setDraft(null);
      setRefreshTrigger((p) => p + 1);
    } catch {
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa khu đô thị này? Tất cả tòa nhà bên trong cũng sẽ bị xóa.')) return;
    try {
      await urbanService.deleteUrban(id);
      enqueueSnackbar('Xóa thành công', { variant: 'success' });
      setRefreshTrigger((p) => p + 1);
    } catch {
      enqueueSnackbar('Lỗi khi xóa', { variant: 'error' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'auto' }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
          Quản lý Khu đô thị
        </Typography>
        <Button
          onClick={() => { setDraft({ code: '', name: '', address: '', description: '' }); setModalMode('add'); }}
          variant="contained"
          startIcon={<AddIcon />}
          sx={{ bgcolor: '#00B8DB', color: '#fff', fontWeight: 600, textTransform: 'none', borderRadius: 2, px: 3, py: 1, boxShadow: 'none', '&:hover': { bgcolor: '#0097B5' } }}
        >
          Thêm mới
        </Button>
      </Box>

      <TextField
        fullWidth
        placeholder="Tìm kiếm khu đô thị..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{
          mb: 1.5,
          '& .MuiOutlinedInput-root': { color: '#fff', bgcolor: 'rgba(15,23,42,0.4)', borderRadius: 2, height: 46, '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&.Mui-focused fieldset': { borderColor: '#00B8DB' } },
          '& .MuiInputBase-input::placeholder': { color: '#9ca3af', opacity: 1 },
        }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#9ca3af', fontSize: 20 }} /></InputAdornment> }}
      />

      <Box sx={{ flex: 1, bgcolor: 'rgba(15,23,42,0.6)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', overflow: 'auto', backdropFilter: 'blur(16px)' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { px: 2, py: 1.5, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#e2e8f0', fontSize: 13 }, '& th': { color: '#94a3b8', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 } }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Mã</th>
              <th>Tên</th>
              <th>Slug</th>
              <th>Tòa nhà</th>
              <th>Tọa độ</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Đang tải...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Không có dữ liệu</td></tr>}
            {filtered.map((u, i) => (
              <tr key={u.id} style={{ transition: 'background 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td>{i + 1}</td>
                <td><Chip label={u.code || '—'} size="small" sx={{ bgcolor: 'rgba(0,184,219,0.15)', color: '#00B8DB', fontWeight: 600, fontSize: 11 }} /></td>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td style={{ color: '#64748b', fontSize: 12 }}>{u.slug}</td>
                <td><Chip label={`${u._count?.buildings ?? u.buildings?.length ?? 0}`} size="small" sx={{ bgcolor: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 600, minWidth: 32 }} /></td>
                <td style={{ fontSize: 12 }}>
                  {u.latitude && u.longitude ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#94a3b8' }}>
                      <MapPin size={12} /> {u.latitude?.toFixed(4)}, {u.longitude?.toFixed(4)}
                    </Box>
                  ) : '—'}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                    <Tooltip title="Xem"><IconButton size="small" onClick={() => { setDraft(u); setModalMode('view'); }} sx={{ color: '#94a3b8', '&:hover': { color: '#00B8DB' } }}><Eye size={16} /></IconButton></Tooltip>
                    <Tooltip title="Sửa"><IconButton size="small" onClick={() => { setDraft(u); setModalMode('edit'); }} sx={{ color: '#94a3b8', '&:hover': { color: '#fbbf24' } }}><Edit2 size={16} /></IconButton></Tooltip>
                    <Tooltip title="Xóa"><IconButton size="small" onClick={() => handleDelete(u.id)} sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}><Trash2 size={16} /></IconButton></Tooltip>
                  </Box>
                </td>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>

      {/* Modal Add/Edit/View */}
      <Dialog open={!!modalMode} onClose={() => { setModalMode(null); setDraft(null); }} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#0d1b2e', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 3, boxShadow: '0 25px 60px rgba(0,0,0,0.8)' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 3, pb: 2 }}>
          <Typography sx={{ color: '#00e5ff', fontWeight: 700, fontSize: 18 }}>
            {modalMode === 'add' ? 'Thêm mới' : modalMode === 'edit' ? 'Chỉnh sửa' : 'Chi tiết'} Khu đô thị
          </Typography>
          <Box component="button" onClick={() => { setModalMode(null); setDraft(null); }} sx={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', p: 0.5, '&:hover': { color: '#94a3b8' } }}>
            <X size={20} />
          </Box>
        </Box>
        <Box sx={{ px: 3, pb: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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
          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Địa chỉ</Typography>
            <input style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.address ?? ''} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, address: e.target.value } : d)} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Vĩ độ (Lat)</Typography>
              <input type="number" step="any" style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.latitude ?? ''} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, latitude: parseFloat(e.target.value) || undefined } : d)} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Kinh độ (Lon)</Typography>
              <input type="number" step="any" style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }} value={draft?.longitude ?? ''} readOnly={modalMode === 'view'} onChange={(e) => setDraft((d) => d ? { ...d, longitude: parseFloat(e.target.value) || undefined } : d)} />
            </Box>
          </Box>
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

export default UrbanManagementPanel;
