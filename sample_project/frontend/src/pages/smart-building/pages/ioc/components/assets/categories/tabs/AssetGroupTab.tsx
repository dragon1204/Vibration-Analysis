import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import type { AssetGroup } from '@/services/ioc/category.service';
import { categoryService } from '@/services/ioc/category.service';

interface AssetGroupTabProps {
  search: string;
  refreshTrigger: number;
  onView: (item: AssetGroup) => void;
  onEdit: (item: AssetGroup) => void;
  onDelete: (item: AssetGroup) => void;
}

export const AssetGroupTab = ({
  search,
  refreshTrigger,
  onView,
  onEdit,
  onDelete,
}: AssetGroupTabProps) => {
  const [data, setData] = useState<AssetGroup[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<AssetGroup | null>(null);

  const handleOpenMenu = (
    event: React.MouseEvent<HTMLElement>,
    row: AssetGroup,
  ) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  useEffect(() => {
    let active = true;
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await categoryService.getAssetGroups(
          page * rowsPerPage,
          rowsPerPage,
          search,
        );
        if (active) {
          setData(res.items || []);
          setTotalCount(res.totalCount || 0);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetch();
    return () => {
      active = false;
    };
  }, [page, rowsPerPage, search, refreshTrigger]);

  return (
    <>
      <TableContainer
        sx={{
          flex: 1,
          overflow: 'auto',
          '&::-webkit-scrollbar': { width: '6px', height: '6px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '8px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(255,255,255,0.25)',
          },
        }}
      >
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  bgcolor: '#1a2332',
                  color: '#9ca3af',
                  fontWeight: 600,
                  fontSize: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  py: 2,
                  pl: 4,
                }}
              >
                MÃ NHÓM
              </TableCell>
              <TableCell
                sx={{
                  bgcolor: '#1a2332',
                  color: '#9ca3af',
                  fontWeight: 600,
                  fontSize: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  py: 2,
                }}
              >
                TÊN NHÓM
              </TableCell>
              <TableCell
                sx={{
                  bgcolor: '#1a2332',
                  color: '#9ca3af',
                  fontWeight: 600,
                  fontSize: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  py: 2,
                }}
              >
                MÃ HỆ THỐNG
              </TableCell>
              <TableCell
                sx={{
                  bgcolor: '#1a2332',
                  color: '#9ca3af',
                  fontWeight: 600,
                  fontSize: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  py: 2,
                }}
              >
                NHÓM CHA
              </TableCell>
              <TableCell
                sx={{
                  bgcolor: '#1a2332',
                  color: '#9ca3af',
                  fontWeight: 600,
                  fontSize: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  py: 2,
                }}
              >
                MÔ TẢ
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  bgcolor: '#1a2332',
                  color: '#9ca3af',
                  fontWeight: 600,
                  fontSize: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  py: 2,
                  pr: 4,
                }}
              >
                HÀNH ĐỘNG
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <AnimatePresence>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    align="center"
                    sx={{ py: 8, borderBottom: 'none' }}
                  >
                    <CircularProgress size={30} sx={{ color: '#00B8DB' }} />
                  </TableCell>
                </TableRow>
              ) : data.length > 0 ? (
                data.map((row, index) => (
                  <motion.tr
                    key={row.id ?? row.code}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.05 }}
                    style={{ transition: 'background-color 0.2s' }}
                    className="hover:bg-white/5"
                  >
                    <TableCell
                      sx={{
                        color: '#00B8DB',
                        fontWeight: 500,
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        py: 2.5,
                        pl: 4,
                      }}
                    >
                      {row.code}
                    </TableCell>
                    <TableCell
                      sx={{
                        color: '#e5e7eb',
                        fontWeight: 500,
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        py: 2.5,
                      }}
                    >
                      {row.name}
                    </TableCell>
                    <TableCell
                      sx={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        py: 2.5,
                      }}
                    >
                      {row.systemCodeCode ? (
                        <Chip
                          label={`${row.systemCodeCode}`}
                          size="small"
                          title={row.systemCodeName}
                          sx={{
                            bgcolor: 'rgba(0,184,219,0.15)',
                            color: '#00B8DB',
                            fontWeight: 600,
                            border: '1px solid rgba(0,184,219,0.3)',
                            fontSize: 11,
                            height: 22,
                          }}
                        />
                      ) : (
                        <Typography sx={{ color: '#6b7280', fontSize: 13 }}>
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell
                      sx={{
                        color: '#9ca3af',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        py: 2.5,
                        fontSize: 13,
                      }}
                    >
                      {row.parentName ?? '—'}
                    </TableCell>
                    <TableCell
                      sx={{
                        color: '#e5e7eb',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        py: 2.5,
                        maxWidth: 220,
                      }}
                    >
                      <Typography
                        noWrap
                        sx={{ fontSize: 14, color: '#9ca3af' }}
                      >
                        {row.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        py: 2.5,
                        pr: 4,
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenMenu(e, row)}
                        sx={{
                          color: '#9ca3af',
                          '&:hover': {
                            color: '#fff',
                            bgcolor: 'rgba(255,255,255,0.1)',
                          },
                        }}
                      >
                        <MoreVertIcon fontSize="small" sx={{ fontSize: 20 }} />
                      </IconButton>
                    </TableCell>
                  </motion.tr>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    align="center"
                    sx={{ py: 8, borderBottom: 'none' }}
                  >
                    <Typography sx={{ color: '#9ca3af' }}>
                      Mục này chưa có dữ liệu
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Footer */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>
            Số hàng mỗi trang:
          </Typography>
          <Select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(e.target.value as number);
              setPage(0);
            }}
            size="small"
            sx={{
              color: '#fff',
              fontSize: 13,
              height: 32,
              bgcolor: 'rgba(255,255,255,0.02)',
              '& .MuiSelect-icon': { color: '#9ca3af' },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255,255,255,0.1)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255,255,255,0.2)',
              },
            }}
          >
            <MenuItem value={10}>10</MenuItem>
            <MenuItem value={20}>20</MenuItem>
            <MenuItem value={50}>50</MenuItem>
          </Select>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>
            {totalCount === 0
              ? '0-0 trên 0'
              : `${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, totalCount)} trên ${totalCount}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              sx={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.15)',
                bgcolor: 'rgba(255,255,255,0.02)',
                textTransform: 'none',
                minWidth: 'unset',
                px: 2,
                py: 0.5,
                '&.Mui-disabled': {
                  color: '#6b7280',
                  borderColor: 'rgba(255,255,255,0.05)',
                },
              }}
            >
              Trước
            </Button>
            <Button
              variant="outlined"
              disabled={(page + 1) * rowsPerPage >= totalCount}
              onClick={() => setPage(page + 1)}
              sx={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.15)',
                bgcolor: 'rgba(255,255,255,0.02)',
                textTransform: 'none',
                minWidth: 'unset',
                px: 2,
                py: 0.5,
                '&.Mui-disabled': {
                  color: '#6b7280',
                  borderColor: 'rgba(255,255,255,0.05)',
                },
              }}
            >
              Sau
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
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
            minWidth: 120,
            mt: 0.5,
            '& .MuiMenuItem-root': {
              fontSize: 14,
              px: 3,
              py: 1.5,
              fontWeight: 500,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            handleCloseMenu();
            if (selectedRow) onView(selectedRow);
          }}
        >
          <VisibilityOutlinedIcon
            fontSize="small"
            sx={{ mr: 1.5, color: '#9ca3af' }}
          />
          Xem
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleCloseMenu();
            if (selectedRow) onEdit(selectedRow);
          }}
        >
          <EditOutlinedIcon
            fontSize="small"
            sx={{ mr: 1.5, color: '#9ca3af' }}
          />
          Sửa
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleCloseMenu();
            if (selectedRow) onDelete(selectedRow);
          }}
          sx={{
            color: '#ef4444',
            '&:hover': { bgcolor: 'rgba(239,68,68,0.1) !important' },
          }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1.5 }} />
          Xóa
        </MenuItem>
      </Menu>
    </>
  );
};
