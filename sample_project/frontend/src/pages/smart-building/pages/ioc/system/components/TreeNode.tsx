import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Box, IconButton, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useState } from 'react';
import type { ManagementDepartment } from '@/services/ioc/management-department.service';

interface TreeNodeProps {
  node: ManagementDepartment;
  depth: number;
  selectedId: number | null;
  onSelect: (node: ManagementDepartment) => void;
  onMenu: (e: React.MouseEvent<HTMLElement>, row: ManagementDepartment) => void;
  forceExpand: boolean;
}

export const TreeNode = ({ node, depth, selectedId, onSelect, onMenu, forceExpand }: TreeNodeProps) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isSelected = selectedId === node.id;
  const effectiveExpanded = forceExpand ? true : expanded;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Box
        onClick={() => onSelect(node)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 0.75,
          px: 1,
          borderRadius: 1.5,
          mt: 0.5,
          pl: `${8 + depth * 20}px`,
          cursor: 'pointer',
          bgcolor: isSelected ? 'rgba(0,184,219,0.15)' : 'rgba(255,255,255,0.02)',
          border: isSelected ? '1px solid rgba(0,184,219,0.4)' : '1px solid transparent',
          '&:hover': { bgcolor: isSelected ? 'rgba(0,184,219,0.18)' : 'rgba(255,255,255,0.05)' },
          transition: 'all 0.15s',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {hasChildren ? (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((p) => !p);
              }}
              sx={{ color: '#9ca3af', p: 0.25 }}
            >
              {effectiveExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </IconButton>
          ) : (
            <ChevronRightIcon sx={{ fontSize: 14, color: '#475569', ml: 0.5 }} />
          )}
          <Typography sx={{ color: '#00B8DB', fontWeight: hasChildren ? 600 : 500, fontSize: 13, ml: 0.5 }}>
            {node.code}
          </Typography>
          <Typography sx={{ color: '#e5e7eb', fontWeight: 500, fontSize: 14 }}>{node.name}</Typography>
          {node.description && (
            <Typography sx={{ color: '#64748b', fontSize: 12, ml: 0.5 }}>— {node.description}</Typography>
          )}
        </Box>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onMenu(e, node);
          }}
          sx={{ color: '#9ca3af', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}
        >
          <MoreVertIcon fontSize="small" sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {hasChildren && effectiveExpanded && (
        <Box sx={{ borderLeft: '1px dashed rgba(255,255,255,0.16)', ml: `${16 + depth * 20}px` }}>
          {(node.children ?? []).map((child, i) => (
            <TreeNode
              key={child.id ?? `${child.code}-${i}`}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onMenu={onMenu}
              forceExpand={forceExpand}
            />
          ))}
        </Box>
      )}
    </motion.div>
  );
};
