import { Box, Dialog, Typography } from '@mui/material';
import { Save, X } from 'lucide-react';
import type { ManagementDepartment } from '@/services/ioc/management-department.service';

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

interface DepartmentFormModalProps {
  open: boolean;
  mode: 'add' | 'edit' | 'view' | null;
  draft: Partial<ManagementDepartment> | null;
  allDepartments: ManagementDepartment[];
  onClose: () => void;
  onSave: () => void;
  onDraftChange: (draft: Partial<ManagementDepartment>) => void;
}

export const DepartmentFormModal = ({
  open,
  mode,
  draft,
  allDepartments,
  onClose,
  onSave,
  onDraftChange,
}: DepartmentFormModalProps) => {
  const getFormTitle = () => {
    if (mode === 'add') return 'Thêm mới Cơ cấu tổ chức quản lý';
    if (mode === 'edit') return 'Sửa Cơ cấu tổ chức quản lý';
    return 'Chi tiết Cơ cấu tổ chức quản lý';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#0d1b2e', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 3, boxShadow: '0 25px 60px rgba(0,0,0,0.8)' } }}
      sx={{ '& .MuiDialog-container': { alignItems: 'center' } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 3, pb: 2 }}>
        <Typography sx={{ color: '#00e5ff', fontWeight: 700, fontSize: 18 }}>{getFormTitle()}</Typography>
        <Box component="button" onClick={onClose} sx={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', p: 0.5, '&:hover': { color: '#94a3b8' } }}>
          <X size={20} />
        </Box>
      </Box>

      <Box sx={{ px: 3, pb: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
              Mã phòng {mode !== 'view' && <span style={{ color: '#ef4444' }}>*</span>}
            </Typography>
            <input
              style={{ ...fieldStyle, border: !draft?.code && mode !== 'view' ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.12)', opacity: mode === 'edit' || mode === 'view' ? 0.7 : 1 }}
              value={draft?.code ?? ''}
              readOnly={mode === 'edit' || mode === 'view'}
              onChange={(e) => onDraftChange({ ...draft, code: e.target.value })}
              onFocus={(e) => {
                if (mode === 'add') e.target.style.borderColor = '#00c8ff';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = draft?.code ? 'rgba(255,255,255,0.12)' : 'rgba(239,68,68,0.5)';
              }}
            />
          </Box>
          <Box sx={{ flex: 2 }}>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
              Tên phòng ban {mode !== 'view' && <span style={{ color: '#ef4444' }}>*</span>}
            </Typography>
            <input
              style={{ ...fieldStyle, border: !draft?.name && mode !== 'view' ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.12)', opacity: mode === 'view' ? 0.7 : 1 }}
              value={draft?.name ?? ''}
              readOnly={mode === 'view'}
              onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
              onFocus={(e) => {
                if (mode !== 'view') e.target.style.borderColor = '#00c8ff';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = draft?.name ? 'rgba(255,255,255,0.12)' : 'rgba(239,68,68,0.5)';
              }}
            />
          </Box>
        </Box>

        <Box>
          <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Phòng ban cha</Typography>
          <select
            disabled={mode === 'view'}
            style={{ ...fieldStyle, opacity: mode === 'view' ? 0.7 : 1, cursor: mode === 'view' ? 'default' : 'pointer', appearance: 'none' as const }}
            value={draft?.parentId ?? ''}
            onChange={(e) => onDraftChange({ ...draft, parentId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="" style={{ background: '#0d1b2e' }}>— Không có (root) —</option>
            {allDepartments.filter((f) => f.id !== draft?.id).map((f) => (
              <option key={f.id} value={f.id} style={{ background: '#0d1b2e' }}>{f.code} — {f.name}</option>
            ))}
          </select>
        </Box>

        <Box>
          <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Mô tả</Typography>
          <input
            style={{ ...fieldStyle, opacity: mode === 'view' ? 0.7 : 1 }}
            value={draft?.description ?? ''}
            readOnly={mode === 'view'}
            placeholder="Nhập mô tả (tùy chọn)"
            onChange={(e) => onDraftChange({ ...draft, description: e.target.value })}
            onFocus={(e) => {
              if (mode !== 'view') e.target.style.borderColor = '#00c8ff';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255,255,255,0.12)';
            }}
          />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, pt: 2, px: 3, pb: 3 }}>
        {mode !== 'view' && (
          <Box
            component="button"
            onClick={onSave}
            sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, py: 1.25, borderRadius: 2, border: 'none', bgcolor: '#00c8ff', color: '#020617', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { bgcolor: '#00e5ff' } }}
          >
            <Save size={16} /> Lưu thông tin
          </Box>
        )}
        <Box
          component="button"
          onClick={onClose}
          sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, py: 1.25, borderRadius: 2, border: 'none', bgcolor: 'rgba(255,255,255,0.1)', color: '#f1f5f9', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
        >
          {mode === 'view' ? 'Đóng' : 'Hủy bỏ'}
        </Box>
      </Box>
    </Dialog>
  );
};
