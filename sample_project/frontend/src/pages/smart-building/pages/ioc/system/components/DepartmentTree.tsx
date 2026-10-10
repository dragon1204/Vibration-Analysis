import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, CircularProgress, IconButton, Typography } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { ManagementDepartment } from '@/services/ioc/management-department.service';
import { TreeNode } from './TreeNode';

interface DepartmentTreeProps {
  loading: boolean;
  filteredTree: ManagementDepartment[];
  totalCount: number;
  selectedDept: ManagementDepartment | null;
  isSearching: boolean;
  onSelectDept: (dept: ManagementDepartment) => void;
  onOpenMenu: (e: React.MouseEvent<HTMLElement>, row: ManagementDepartment) => void;
}

export const DepartmentTree = ({
  loading,
  filteredTree,
  totalCount,
  selectedDept,
  isSearching,
  onSelectDept,
  onOpenMenu,
}: DepartmentTreeProps) => {
  const [expandedRoot, setExpandedRoot] = useState(true);

  return (
    <Box sx={{ flex: selectedDept ? '0 0 42%' : '1 1 100%', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(15, 23, 42, 0.6)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', backdropFilter: 'blur(16px)', transition: 'flex 0.3s ease' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(26,35,50,0.65)', flexShrink: 0 }}>
        <Typography sx={{ color: '#9ca3af', fontWeight: 600, fontSize: 12 }}>SƠ ĐỒ CƠ CẤU DẠNG CÂY</Typography>
        <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>{totalCount} phòng ban</Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2, '&::-webkit-scrollbar': { width: '6px' }, '&::-webkit-scrollbar-track': { background: 'transparent' }, '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: '8px' } }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={30} sx={{ color: '#00B8DB' }} />
          </Box>
        ) : filteredTree.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <Typography sx={{ color: '#9ca3af' }}>Mục này chưa có dữ liệu</Typography>
          </Box>
        ) : (
          <AnimatePresence>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', py: 1, px: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <IconButton size="small" onClick={() => setExpandedRoot((p) => !p)} sx={{ color: '#9ca3af', mr: 1 }}>
                    {expandedRoot ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                  </IconButton>
                  <Typography sx={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>Cơ cấu tổ chức quản lý</Typography>
                </Box>
              </motion.div>

              {expandedRoot && (
                <Box sx={{ pl: 2, borderLeft: '1px dashed rgba(255,255,255,0.2)', ml: 2 }}>
                  {filteredTree.map((node, i) => (
                    <TreeNode
                      key={node.id ?? `${node.code}-${i}`}
                      node={node}
                      depth={0}
                      selectedId={selectedDept?.id ?? null}
                      onSelect={(n) => onSelectDept(selectedDept?.id === n.id ? null as any : n)}
                      onMenu={onOpenMenu}
                      forceExpand={isSearching}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </AnimatePresence>
        )}
      </Box>
    </Box>
  );
};
