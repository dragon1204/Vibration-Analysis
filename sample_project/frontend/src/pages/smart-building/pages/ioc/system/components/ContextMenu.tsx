import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Menu, MenuItem } from '@mui/material';
import type { ManagementDepartment } from '@/services/ioc/management-department.service';

interface ContextMenuProps {
  anchorEl: HTMLElement | null;
  selectedRow: ManagementDepartment | null;
  onClose: () => void;
  onView: (item: ManagementDepartment) => void;
  onEdit: (item: ManagementDepartment) => void;
  onDelete: (item: ManagementDepartment) => void;
}

export const ContextMenu = ({
  anchorEl,
  selectedRow,
  onClose,
  onView,
  onEdit,
  onDelete,
}: ContextMenuProps) => {
  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      PaperProps={{
        sx: {
          bgcolor: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#e5e7eb',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          borderRadius: 2,
          minWidth: 140,
          mt: 0.5,
          '& .MuiMenuItem-root': { fontSize: 14, px: 3, py: 1.5, fontWeight: 500, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } },
        },
      }}
    >
      <MenuItem
        onClick={() => {
          onClose();
          if (selectedRow) onView(selectedRow);
        }}
      >
        <VisibilityOutlinedIcon fontSize="small" sx={{ mr: 1.5, color: '#9ca3af' }} />
        Xem
      </MenuItem>
      <MenuItem
        onClick={() => {
          onClose();
          if (selectedRow) onEdit(selectedRow);
        }}
      >
        <EditOutlinedIcon fontSize="small" sx={{ mr: 1.5, color: '#9ca3af' }} />
        Sửa
      </MenuItem>
      <MenuItem
        onClick={() => {
          onClose();
          if (selectedRow) onDelete(selectedRow);
        }}
        sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1) !important' } }}
      >
        <DeleteOutlineIcon fontSize="small" sx={{ mr: 1.5 }} />
        Xóa
      </MenuItem>
    </Menu>
  );
};
