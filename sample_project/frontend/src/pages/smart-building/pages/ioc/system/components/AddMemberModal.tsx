import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Checkbox,
  CircularProgress,
  Dialog,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { Save, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useEffect, useRef, useState } from 'react';
import {
  hrManagementService,
  type HrManagement,
} from '@/services/ioc/hr-management.service';

interface AddMemberModalProps {
  open: boolean;
  departmentId: number;
  departmentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddMemberModal = ({ open, departmentId, departmentName, onClose, onSuccess }: AddMemberModalProps) => {
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [allStaff, setAllStaff] = useState<HrManagement[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingStaff(true);
    hrManagementService
      .getAll(0, 200, debouncedSearch || undefined)
      .then((res) => {
        if (active) {
          setAllStaff(res.items.filter((s) => s.departmentUnitId !== departmentId));
          setTotalCount(res.totalCount);
        }
      })
      .catch(() => {
        // Handle error silently
      })
      .finally(() => {
        if (active) setLoadingStaff(false);
      });
    return () => {
      active = false;
    };
  }, [open, debouncedSearch, departmentId]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedIds(new Set());
    }
  }, [open]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((hrId) => hrManagementService.assignDepartment(hrId, departmentId))
      );
      enqueueSnackbar(`Đã thêm ${selectedIds.size} thành viên`, { variant: 'success' });
      onSuccess();
      onClose();
    } catch {
      enqueueSnackbar('Có lỗi khi thêm thành viên', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { bgcolor: '#0d1b2e', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 3, boxShadow: '0 25px 60px rgba(0,0,0,0.8)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 3, pb: 2 }}>
        <Box>
          <Typography sx={{ color: '#00e5ff', fontWeight: 700, fontSize: 17 }}>Thêm thành viên</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 13, mt: 0.25 }}>{departmentName}</Typography>
        </Box>
        <Box component="button" onClick={onClose} sx={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', p: 0.5, '&:hover': { color: '#94a3b8' } }}>
          <X size={20} />
        </Box>
      </Box>

      <Box sx={{ px: 3, pb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Tìm theo tên, tài khoản..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ '& .MuiOutlinedInput-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&.Mui-focused fieldset': { borderColor: '#00B8DB' } }, '& .MuiInputBase-input::placeholder': { color: '#9ca3af', opacity: 1 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#9ca3af', fontSize: 18 }} /></InputAdornment> }}
        />
      </Box>

      <Box sx={{ mx: 3, mb: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', maxHeight: 360, overflowY: 'auto', '&::-webkit-scrollbar': { width: 5 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: 4 } }}>
        {loadingStaff ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} sx={{ color: '#00B8DB' }} />
          </Box>
        ) : allStaff.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ color: '#64748b', fontSize: 13 }}>Không tìm thấy nhân sự</Typography>
          </Box>
        ) : (
          allStaff.map((staff, i) => {
            const id = staff.id!;
            const checked = selectedIds.has(id);
            return (
              <Box
                key={id}
                onClick={() => toggleSelect(id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1,
                  cursor: 'pointer',
                  bgcolor: checked ? 'rgba(0,184,219,0.1)' : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  '&:hover': { bgcolor: 'rgba(0,184,219,0.08)' },
                  transition: 'background 0.15s',
                }}
              >
                <Checkbox
                  checked={checked}
                  size="small"
                  sx={{ p: 0, color: '#475569', '&.Mui-checked': { color: '#00B8DB' } }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: '#e5e7eb', fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>
                    {staff.name ?? ''}{staff.surname ? ` ${staff.surname}` : ''}
                  </Typography>
                  <Typography sx={{ color: '#64748b', fontSize: 12 }}>{staff.accountName ?? staff.email ?? ''}</Typography>
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, px: 3, pb: 3, alignItems: 'center' }}>
        <Typography sx={{ color: '#64748b', fontSize: 13, flex: 1 }}>
          {selectedIds.size > 0 ? `Đã chọn ${selectedIds.size} người` : `${totalCount} nhân sự`}
        </Typography>
        <Box
          component="button"
          onClick={handleSave}
          disabled={selectedIds.size === 0 || saving}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 3, py: 1.25, borderRadius: 2, border: 'none', bgcolor: selectedIds.size === 0 ? 'rgba(255,255,255,0.08)' : '#00c8ff', color: selectedIds.size === 0 ? '#475569' : '#020617', fontSize: 14, fontWeight: 700, cursor: selectedIds.size === 0 ? 'default' : 'pointer', transition: 'all 0.2s', '&:hover': { bgcolor: selectedIds.size > 0 ? '#00e5ff' : 'rgba(255,255,255,0.08)' } }}
        >
          {saving ? <CircularProgress size={14} sx={{ color: '#020617' }} /> : <Save size={15} />}
          Thêm vào phòng ban
        </Box>
        <Box
          component="button"
          onClick={onClose}
          sx={{ px: 3, py: 1.25, borderRadius: 2, border: 'none', bgcolor: 'rgba(255,255,255,0.08)', color: '#f1f5f9', fontSize: 14, fontWeight: 600, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.13)' } }}
        >
          Hủy
        </Box>
      </Box>
    </Dialog>
  );
};
