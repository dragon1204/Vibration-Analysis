import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { Save, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';

import {
  type HrManagement,
  type HrUserOption,
  hrManagementService,
} from '@/services/ioc/hr-management.service';

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 14,
  outline: 'none',
};

const selectFieldSx = {
  color: '#fff',
  height: 41,
  '& .MuiSelect-icon': { color: '#9ca3af' },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(255,255,255,0.12)',
  },
};

const getUserLabel = (user: HrUserOption) => {
  const fullName =
    user.fullName?.trim() || `${user.name ?? ''} ${user.surname ?? ''}`.trim();
  return fullName ? `${fullName} (${user.userName})` : user.userName;
};

type HrFormDraft = Omit<Partial<HrManagement>, 'userId'> & {
  userId?: string | number;
  repassword?: string;
};
const toSelectValue = (value?: string | number | null) => {
  if (value === '' || value === undefined || value === null) return '';
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : '';
};

const HrManagementPanel = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [data, setData] = useState<HrManagement[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<HrManagement | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(
    null,
  );
  const [draft, setDraft] = useState<HrFormDraft | null>(null);
  const [users, setUsers] = useState<HrUserOption[]>([]);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      const res = await hrManagementService.getAll(
        page * rowsPerPage,
        rowsPerPage,
        search,
      );
      if (active) {
        setData(res.items || []);
        setTotalCount(res.totalCount || 0);
        setLoading(false);
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, [page, rowsPerPage, search, refreshTrigger]);

  useEffect(() => {
    let active = true;
    const fetchOptions = async () => {
      const userOptions = await hrManagementService.getAllUsers();
      if (active) {
        setUsers(userOptions || []);
      }
    };
    fetchOptions();
    return () => {
      active = false;
    };
  }, []);

  const openAdd = () => {
    setDraft({
      name: '',
      surname: '',
      accountName: '',
      password: '',
      repassword: '',
      email: '',
      specialize: '',
      userId: '',
      type: 1,
      addressOfBirth: '',
      dateOfBirth: null,
    });
    setModalMode('add');
  };

  const closeModal = () => {
    setModalMode(null);
    setDraft(null);
  };

  const save = async () => {
    if (
      !draft?.name?.trim() ||
      !draft?.surname?.trim() ||
      !draft?.accountName?.trim() ||
      !draft?.email?.trim()
    ) {
      enqueueSnackbar('Vui lòng nhập đầy đủ Tên, Họ, Tài khoản và Email', {
        variant: 'warning',
      });
      return;
    }

    if (showPasswordValidation) {
      if (!draft?.password?.trim() || !draft?.repassword?.trim()) {
        enqueueSnackbar('Vui lòng nhập mật khẩu và nhập lại mật khẩu', {
          variant: 'warning',
        });
        return;
      }
      if (draft.password !== draft.repassword) {
        enqueueSnackbar('Mật khẩu nhập lại không đúng', { variant: 'warning' });
        return;
      }
    }

    try {
      const userId =
        draft.userId === '' ||
        draft.userId === undefined ||
        draft.userId === null
          ? undefined
          : Number(draft.userId);
      const { repassword: _repassword, ...payload } = {
        ...draft,
        name: draft.name?.trim(),
        surname: draft.surname?.trim(),
        accountName: draft.accountName?.trim(),
        email: draft.email?.trim(),
        userId,
        dateOfBirth: draft.dateOfBirth || null,
        type: Number(draft.type ?? 1),
      };

      if (modalMode === 'add') await hrManagementService.create(payload);
      if (modalMode === 'edit') await hrManagementService.update(payload);
      enqueueSnackbar('Lưu thành công', { variant: 'success' });
      closeModal();
      setRefreshTrigger((x) => x + 1);
    } catch (_e) {
      enqueueSnackbar('Lưu thất bại', { variant: 'error' });
    }
  };

  const remove = async (item: HrManagement) => {
    if (!item.id) return;
    if (!confirm('Bạn có chắc chắn muốn xoá mục này?')) return;
    await hrManagementService.delete(item.id);
    setRefreshTrigger((x) => x + 1);
  };

  const isUserSelected = Boolean(
    draft?.userId !== '' &&
    draft?.userId !== undefined &&
    draft?.userId !== null,
  );
  const showPasswordFields = modalMode === 'add' && !isUserSelected;

  const handleUserChange = (value: string | number) => {
    if (value === '') {
      setDraft((d) => ({
        ...(d ?? {}),
        userId: '',
        name: '',
        surname: '',
        accountName: '',
        email: '',
        dateOfBirth: null,
        password: '',
        repassword: '',
      }));
      return;
    }

    const selectedUserId = Number(value);
    const selectedUser = users.find((user) => user.id === selectedUserId);

    setDraft((d) => ({
      ...(d ?? {}),
      userId: selectedUserId,
      name: selectedUser?.name ?? '',
      surname: selectedUser?.surname ?? '',
      accountName: selectedUser?.userName ?? '',
      email: selectedUser?.emailAddress ?? '',
      dateOfBirth: selectedUser?.dateOfBirth ?? null,
      password: '',
      repassword: '',
    }));
  };

  const accountNameReadOnly =
    modalMode === 'view' || modalMode === 'edit' || isUserSelected;
  const showPasswordValidation = modalMode === 'add' && !isUserSelected;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        width: '100%',
        height: '100%',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1.5,
        }}
      >
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
          Quản lý nhân sự
        </Typography>
        <Button
          onClick={openAdd}
          variant="contained"
          startIcon={<AddIcon />}
          sx={{ bgcolor: '#00B8DB', textTransform: 'none' }}
        >
          Thêm
        </Button>
      </Box>
      <TextField
        fullWidth
        placeholder="Tìm kiếm..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
        sx={{
          mb: 1.5,
          '& .MuiOutlinedInput-root': {
            color: '#fff',
            bgcolor: 'rgba(15, 23, 42, 0.4)',
            borderRadius: 2,
          },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: '#9ca3af', fontSize: 20 }} />
            </InputAdornment>
          ),
        }}
      />

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          backdropFilter: 'blur(16px)',
        }}
      >
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{ bgcolor: '#1a2332', color: '#9ca3af', fontWeight: 600 }}
                >
                  Họ tên
                </TableCell>
                <TableCell
                  sx={{ bgcolor: '#1a2332', color: '#9ca3af', fontWeight: 600 }}
                >
                  Tài khoản
                </TableCell>
                <TableCell
                  sx={{ bgcolor: '#1a2332', color: '#9ca3af', fontWeight: 600 }}
                >
                  Email
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ bgcolor: '#1a2332', color: '#9ca3af', fontWeight: 600 }}
                >
                  Hành động
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <AnimatePresence>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <CircularProgress size={28} sx={{ color: '#00B8DB' }} />
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row, index) => (
                    <motion.tr
                      key={row.id ?? `${row.userId}-${index}`}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <TableCell sx={{ color: '#e5e7eb' }}>
                        {`${row.name ?? ''} ${row.surname ?? ''}`.trim()}
                      </TableCell>
                      <TableCell sx={{ color: '#e5e7eb' }}>
                        {row.accountName}
                      </TableCell>
                      <TableCell sx={{ color: '#e5e7eb' }}>
                        {row.email}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            setAnchorEl(e.currentTarget);
                            setSelectedRow(row);
                          }}
                          sx={{ color: '#9ca3af' }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </TableContainer>
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
          <Select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(e.target.value as number);
              setPage(0);
            }}
            size="small"
            sx={{ color: '#fff', height: 32 }}
          >
            <MenuItem value={10}>10</MenuItem>
            <MenuItem value={20}>20</MenuItem>
          </Select>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              sx={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.15)',
                textTransform: 'none',
              }}
            >
              Trước
            </Button>
            <Button
              variant="outlined"
              disabled={(page + 1) * rowsPerPage >= totalCount}
              onClick={() => setPage((p) => p + 1)}
              sx={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.15)',
                textTransform: 'none',
              }}
            >
              Sau
            </Button>
          </Box>
        </Box>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null);
          setSelectedRow(null);
        }}
      >
        <MenuItem
          onClick={() => {
            if (selectedRow) {
              setDraft(selectedRow);
              setModalMode('view');
            }
            setAnchorEl(null);
          }}
        >
          <VisibilityOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
          Xem
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedRow) {
              setDraft(selectedRow);
              setModalMode('edit');
            }
            setAnchorEl(null);
          }}
        >
          <EditOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
          Sửa
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedRow) remove(selectedRow);
            setAnchorEl(null);
          }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          Xóa
        </MenuItem>
      </Menu>

      <Dialog
        open={!!modalMode}
        onClose={closeModal}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: '#0d1b2e', border: '1px solid rgba(0,200,255,0.15)' },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            pt: 3,
            pb: 2,
          }}
        >
          <Typography sx={{ color: '#00e5ff', fontWeight: 700, fontSize: 18 }}>
            {modalMode === 'add'
              ? 'Thêm nhân sự'
              : modalMode === 'edit'
                ? 'Sửa nhân sự'
                : 'Chi tiết nhân sự'}
          </Typography>
          <Box
            component="button"
            onClick={closeModal}
            sx={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            <X size={20} />
          </Box>
        </Box>
        <Box
          sx={{
            px: 3,
            pb: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 2,
          }}
        >
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
              Người dùng
            </Typography>
            <Select
              fullWidth
              value={toSelectValue(draft?.userId)}
              disabled={modalMode === 'view'}
              displayEmpty
              onChange={(e) => {
                handleUserChange(e.target.value as string | number);
              }}
              sx={selectFieldSx}
            >
              <MenuItem value="">Chọn người dùng</MenuItem>
              {users.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {getUserLabel(user)}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
              Tên{' '}
              {modalMode !== 'view' && (
                <span style={{ color: '#ef4444' }}>*</span>
              )}
            </Typography>
            <input
              style={{
                ...fieldStyle,
                border:
                  !draft?.name && modalMode !== 'view'
                    ? '1px solid rgba(239,68,68,0.5)'
                    : '1px solid rgba(255,255,255,0.12)',
                opacity: modalMode === 'view' ? 0.7 : 1,
              }}
              value={draft?.name ?? ''}
              readOnly={modalMode === 'view'}
              onChange={(e) =>
                setDraft((d) => ({ ...(d ?? {}), name: e.target.value }))
              }
            />
          </Box>

          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
              Họ{' '}
              {modalMode !== 'view' && (
                <span style={{ color: '#ef4444' }}>*</span>
              )}
            </Typography>
            <input
              style={{
                ...fieldStyle,
                border:
                  !draft?.surname && modalMode !== 'view'
                    ? '1px solid rgba(239,68,68,0.5)'
                    : '1px solid rgba(255,255,255,0.12)',
                opacity: modalMode === 'view' ? 0.7 : 1,
              }}
              value={draft?.surname ?? ''}
              readOnly={modalMode === 'view'}
              onChange={(e) =>
                setDraft((d) => ({ ...(d ?? {}), surname: e.target.value }))
              }
            />
          </Box>

          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
              Tên tài khoản{' '}
              {modalMode !== 'view' && (
                <span style={{ color: '#ef4444' }}>*</span>
              )}
            </Typography>
            <input
              style={{
                ...fieldStyle,
                border:
                  !draft?.accountName && modalMode !== 'view'
                    ? '1px solid rgba(239,68,68,0.5)'
                    : '1px solid rgba(255,255,255,0.12)',
                opacity: modalMode === 'view' ? 0.7 : 1,
              }}
              value={draft?.accountName ?? ''}
              readOnly={accountNameReadOnly}
              onChange={(e) =>
                setDraft((d) => ({ ...(d ?? {}), accountName: e.target.value }))
              }
            />
          </Box>

          {showPasswordFields && (
            <>
              <Box>
                <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
                  Mật khẩu <span style={{ color: '#ef4444' }}>*</span>
                </Typography>
                <input
                  type="password"
                  style={{
                    ...fieldStyle,
                    border: !draft?.password
                      ? '1px solid rgba(239,68,68,0.5)'
                      : '1px solid rgba(255,255,255,0.12)',
                  }}
                  value={draft?.password ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...(d ?? {}),
                      password: e.target.value,
                    }))
                  }
                />
              </Box>
              <Box>
                <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
                  Nhập lại mật khẩu <span style={{ color: '#ef4444' }}>*</span>
                </Typography>
                <input
                  type="password"
                  style={{
                    ...fieldStyle,
                    border: !draft?.repassword
                      ? '1px solid rgba(239,68,68,0.5)'
                      : '1px solid rgba(255,255,255,0.12)',
                  }}
                  value={draft?.repassword ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...(d ?? {}),
                      repassword: e.target.value,
                    }))
                  }
                />
              </Box>
            </>
          )}

          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
              Loại nhân viên
            </Typography>
            <Select
              fullWidth
              value={draft?.type ?? 1}
              disabled={modalMode === 'view'}
              onChange={(e) =>
                setDraft((d) => ({
                  ...(d ?? {}),
                  type: Number(e.target.value),
                }))
              }
              sx={selectFieldSx}
            >
              <MenuItem value={1}>Nhân viên quản lý</MenuItem>
              <MenuItem value={2}>Nhân viên dự án</MenuItem>
            </Select>
          </Box>

          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
              Email{' '}
              {modalMode !== 'view' && (
                <span style={{ color: '#ef4444' }}>*</span>
              )}
            </Typography>
            <input
              style={{
                ...fieldStyle,
                border:
                  !draft?.email && modalMode !== 'view'
                    ? '1px solid rgba(239,68,68,0.5)'
                    : '1px solid rgba(255,255,255,0.12)',
                opacity: modalMode === 'view' ? 0.7 : 1,
              }}
              value={draft?.email ?? ''}
              readOnly={modalMode === 'view'}
              onChange={(e) =>
                setDraft((d) => ({ ...(d ?? {}), email: e.target.value }))
              }
            />
          </Box>

          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
              Ngày sinh
            </Typography>
            <input
              type="date"
              style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }}
              value={
                draft?.dateOfBirth ? String(draft.dateOfBirth).slice(0, 10) : ''
              }
              readOnly={modalMode === 'view'}
              onChange={(e) =>
                setDraft((d) => ({
                  ...(d ?? {}),
                  dateOfBirth: e.target.value || null,
                }))
              }
            />
          </Box>

          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
              Nơi sinh
            </Typography>
            <input
              style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }}
              value={draft?.addressOfBirth ?? ''}
              readOnly={modalMode === 'view'}
              onChange={(e) =>
                setDraft((d) => ({
                  ...(d ?? {}),
                  addressOfBirth: e.target.value,
                }))
              }
            />
          </Box>

          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
              Chuyên môn
            </Typography>
            <input
              style={{ ...fieldStyle, opacity: modalMode === 'view' ? 0.7 : 1 }}
              value={draft?.specialize ?? ''}
              readOnly={modalMode === 'view'}
              onChange={(e) =>
                setDraft((d) => ({ ...(d ?? {}), specialize: e.target.value }))
              }
            />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, pt: 2, px: 3, pb: 3 }}>
          {modalMode !== 'view' && (
            <Box
              component="button"
              onClick={save}
              sx={{
                flex: 1,
                py: 1.25,
                borderRadius: 2,
                border: 'none',
                bgcolor: '#00c8ff',
                color: '#020617',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                cursor: 'pointer',
              }}
            >
              <Save size={16} />
              Lưu thông tin
            </Box>
          )}
          <Box
            component="button"
            onClick={closeModal}
            sx={{
              flex: 1,
              py: 1.25,
              borderRadius: 2,
              border: 'none',
              bgcolor: 'rgba(255,255,255,0.1)',
              color: '#f1f5f9',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {modalMode === 'view' ? 'Đóng' : 'Hủy bỏ'}
          </Box>
        </Box>
      </Dialog>
    </motion.div>
  );
};

export default HrManagementPanel;
