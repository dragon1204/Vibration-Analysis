import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import { Box, Button, CircularProgress, IconButton, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import {
  hrManagementService,
  type HrManagement,
} from '@/services/ioc/hr-management.service';
import type { ManagementDepartment } from '@/services/ioc/management-department.service';
import { AddMemberModal } from './AddMemberModal';

interface MembersPanelProps {
  department: ManagementDepartment;
  onRefreshTree: () => void;
}

export const MembersPanel = ({ department, onRefreshTree }: MembersPanelProps) => {
  const { enqueueSnackbar } = useSnackbar();
  const [members, setMembers] = useState<HrManagement[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [membersTrigger, setMembersTrigger] = useState(0);
  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    if (!department.id) return;
    let active = true;

    const fetchMembers = async () => {
      setLoading(true);
      try {
        const res = await hrManagementService.getAll(0, 200, undefined, department.id);
        if (active) {
          setMembers(res.items);
          setTotalCount(res.totalCount);
        }
      } catch {
        // Handle error silently
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchMembers();

    return () => {
      active = false;
    };
  }, [department.id, membersTrigger]);

  const handleRemove = async (staff: HrManagement) => {
    if (!staff.id) return;
    if (!confirm(`Bỏ "${staff.name ?? staff.accountName}" khỏi phòng ban?`)) return;
    try {
      await hrManagementService.removeFromDepartment(staff.id);
      enqueueSnackbar('Đã bỏ thành viên khỏi phòng ban', { variant: 'success' });
      setMembersTrigger((p) => p + 1);
    } catch {
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.75, borderBottom: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(26,35,50,0.65)', flexShrink: 0 }}>
        <Box>
          <Typography sx={{ color: '#00B8DB', fontWeight: 700, fontSize: 13 }}>{department.code}</Typography>
          <Typography sx={{ color: '#f1f5f9', fontWeight: 600, fontSize: 15 }}>{department.name}</Typography>
        </Box>
        <Button
          size="small"
          variant="contained"
          startIcon={<PersonAddOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => setAddModalOpen(true)}
          sx={{ bgcolor: '#00B8DB', color: '#fff', fontWeight: 600, textTransform: 'none', borderRadius: 1.5, px: 2, py: 0.75, boxShadow: 'none', fontSize: 13, '&:hover': { bgcolor: '#0097B5', boxShadow: 'none' } }}
        >
          Thêm thành viên
        </Button>
      </Box>

      <Box sx={{ px: 2.5, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(15,23,42,0.3)', flexShrink: 0 }}>
        <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 600 }}>
          THÀNH VIÊN — {totalCount} người
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', '&::-webkit-scrollbar': { width: 5 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.12)', borderRadius: 4 } }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} sx={{ color: '#00B8DB' }} />
          </Box>
        ) : members.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 1 }}>
            <Typography sx={{ color: '#475569', fontSize: 13 }}>Chưa có thành viên nào</Typography>
            <Typography sx={{ color: '#334155', fontSize: 12 }}>Nhấn "Thêm thành viên" để bắt đầu</Typography>
          </Box>
        ) : (
          members.map((staff, i) => (
            <Box
              key={staff.id ?? i}
              sx={{ display: 'flex', alignItems: 'center', px: 2.5, py: 1.25, borderBottom: '1px solid rgba(255,255,255,0.04)', bgcolor: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
            >
              <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: 'rgba(0,184,219,0.2)', border: '1px solid rgba(0,184,219,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1.5, flexShrink: 0 }}>
                <Typography sx={{ color: '#00B8DB', fontWeight: 700, fontSize: 13 }}>
                  {(staff.name ?? staff.accountName ?? '?').charAt(0).toUpperCase()}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ color: '#e5e7eb', fontSize: 14, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {staff.name ?? ''}{staff.surname ? ` ${staff.surname}` : ''}
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {staff.accountName ?? staff.email ?? ''}
                </Typography>
              </Box>
              <IconButton
                size="small"
                title="Bỏ khỏi phòng ban"
                onClick={() => handleRemove(staff)}
                sx={{ color: '#475569', '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' } }}
              >
                <PersonRemoveOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          ))
        )}
      </Box>

      <AddMemberModal
        open={addModalOpen}
        departmentId={department.id!}
        departmentName={`${department.code} — ${department.name}`}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => { setMembersTrigger((p) => p + 1); onRefreshTree(); }}
      />
    </Box>
  );
};
