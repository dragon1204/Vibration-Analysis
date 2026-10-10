import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type ManagementDepartment,
  managementDepartmentService,
} from '@/services/ioc/management-department.service';

import {
  ContextMenu,
  DepartmentFormModal,
  DepartmentTree,
  MembersPanel,
} from './components';
import { filterTree, flattenTree } from './utils/departmentUtils';

// ─── Main Panel ───────────────────────────────────────────────────────────────
const ManagementDepartmentPanel = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [treeData, setTreeData] = useState<ManagementDepartment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedDept, setSelectedDept] = useState<ManagementDepartment | null>(
    null,
  );
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<ManagementDepartment | null>(
    null,
  );
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(
    null,
  );
  const [draft, setDraft] = useState<Partial<ManagementDepartment> | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const tree = await managementDepartmentService.getTree();
        if (active) {
          setTreeData(tree);
          setTotalCount(flattenTree(tree).length);
        }
      } catch {
        if (active)
          enqueueSnackbar('Không thể tải dữ liệu cơ cấu tổ chức', {
            variant: 'error',
          });
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, [refreshTrigger, enqueueSnackbar]);

  const filteredTree = useMemo(
    () => filterTree(treeData, search),
    [treeData, search],
  );
  const isSearching = search.trim().length > 0;
  const allFlat = useMemo(() => flattenTree(treeData), [treeData]);

  const handleRefreshTree = useCallback(
    () => setRefreshTrigger((p) => p + 1),
    [],
  );

  const handleOpenMenu = (
    event: React.MouseEvent<HTMLElement>,
    row: ManagementDepartment,
  ) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };
  const handleCloseMenu = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const handleOpenAdd = () => {
    setDraft({ code: '', name: '', buildingId: 0, parentId: null });
    setModalMode('add');
  };
  const handleOpenView = (item: ManagementDepartment) => {
    setDraft(item);
    setModalMode('view');
  };
  const handleOpenEdit = (item: ManagementDepartment) => {
    setDraft(item);
    setModalMode('edit');
  };
  const handleCloseModal = () => {
    setModalMode(null);
    setDraft(null);
  };

  const handleSave = async () => {
    if (!draft?.code || !draft?.name) {
      enqueueSnackbar('Vui lòng nhập đầy đủ Mã phòng và Tên phòng ban', {
        variant: 'warning',
      });
      return;
    }
    try {
      const payload = {
        ...draft,
        id: draft.id,
        code: draft.code.trim(),
        name: draft.name.trim(),
        displayName: draft.displayName?.trim() || undefined,
        description: draft.description?.trim() || undefined,
        buildingId: Number(draft.buildingId ?? 0),
        parentId: draft.parentId ?? null,
      };
      if (modalMode === 'add') {
        await managementDepartmentService.createOrUpdate(payload);
        enqueueSnackbar('Thêm mới thành công', { variant: 'success' });
      } else if (modalMode === 'edit') {
        await managementDepartmentService.createOrUpdate(payload);
        enqueueSnackbar('Cập nhật thành công', { variant: 'success' });
      }
      handleCloseModal();
      setRefreshTrigger((p) => p + 1);
    } catch {
      enqueueSnackbar('Có lỗi xảy ra khi lưu dữ liệu', { variant: 'error' });
    }
  };

  const handleDelete = async (item: ManagementDepartment) => {
    if (!item.id) return;
    if (
      !confirm(
        'Bạn có chắc chắn muốn xoá mục này? Tất cả phòng ban con cũng sẽ bị xoá.',
      )
    )
      return;
    try {
      await managementDepartmentService.delete(item.id);
      enqueueSnackbar('Xoá thành công', { variant: 'success' });
      if (selectedDept?.id === item.id) setSelectedDept(null);
      setRefreshTrigger((p) => p + 1);
    } catch {
      enqueueSnackbar('Có lỗi xảy ra khi xoá', { variant: 'error' });
    }
  };

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
      {/* Top bar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1.5,
        }}
      >
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
          Cơ cấu tổ chức quản lý
        </Typography>
        <Button
          onClick={handleOpenAdd}
          variant="contained"
          startIcon={<AddIcon />}
          sx={{
            bgcolor: '#00B8DB',
            color: '#fff',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 2,
            px: 3,
            py: 1,
            boxShadow: 'none',
            '&:hover': { bgcolor: '#0097B5', boxShadow: 'none' },
          }}
        >
          Thêm
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
        <TextField
          fullWidth
          placeholder="Tìm kiếm mã phòng, tên phòng ban..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            flex: 1,
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              bgcolor: 'rgba(15, 23, 42, 0.4)',
              borderRadius: 2,
              height: '46px',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&.Mui-focused fieldset': { borderColor: '#00B8DB' },
            },
            '& .MuiInputBase-input::placeholder': {
              color: '#9ca3af',
              opacity: 1,
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
      </Box>

      {/* Main content: tree left + members right */}
      <Box sx={{ flex: 1, display: 'flex', gap: 1.5, minHeight: 0 }}>
        <DepartmentTree
          loading={loading}
          filteredTree={filteredTree}
          totalCount={totalCount}
          selectedDept={selectedDept}
          isSearching={isSearching}
          onSelectDept={(dept) =>
            setSelectedDept((prev) => (prev?.id === dept?.id ? null : dept))
          }
          onOpenMenu={handleOpenMenu}
        />

        {/* Right: members panel */}
        <AnimatePresence>
          {selectedDept && (
            <motion.div
              key={selectedDept.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{
                flex: '0 0 58%',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
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
                  minHeight: 0,
                }}
              >
                {/* Close button */}
                <Box sx={{ position: 'absolute', zIndex: 1 }} />
                <MembersPanel
                  department={selectedDept}
                  onRefreshTree={handleRefreshTree}
                />
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      <ContextMenu
        anchorEl={anchorEl}
        selectedRow={selectedRow}
        onClose={handleCloseMenu}
        onView={handleOpenView}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
      />

      <DepartmentFormModal
        open={!!modalMode}
        mode={modalMode}
        draft={draft}
        allDepartments={allFlat}
        onClose={handleCloseModal}
        onSave={handleSave}
        onDraftChange={(newDraft) => setDraft(newDraft)}
      />
    </motion.div>
  );
};

export default ManagementDepartmentPanel;
