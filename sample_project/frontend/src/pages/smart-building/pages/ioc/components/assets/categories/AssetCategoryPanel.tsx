import AddIcon from '@mui/icons-material/Add';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Dialog,
  InputAdornment,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import ExcelJS from 'exceljs';
import { motion } from 'framer-motion';
import { Save, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';

import {
  type UserDto,
  userService,
} from '@/pages/smart-building/services/user.service';
import {
  type AssetGroup,
  type AssetManufacturer,
  type AssetType,
  type AssetUnit,
  type SystemCode,
  type WarehouseCategory,
  categoryService,
} from '@/services/ioc/category.service';

import { AssetGroupTab } from './tabs/AssetGroupTab';
import { AssetManufacturerTab } from './tabs/AssetManufacturerTab';
import { AssetTypeTab } from './tabs/AssetTypeTab';
import { AssetUnitTab } from './tabs/AssetUnitTab';
import { SystemCodeTab } from './tabs/SystemCodeTab';
import { WarehouseCategoryTab } from './tabs/WarehouseCategoryTab';

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

const AssetCategoryPanel = () => {
  const { enqueueSnackbar } = useSnackbar();

  const [tabIndex, setTabIndex] = useState(0);
  const [search, setSearch] = useState('');

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [systemCodes, setSystemCodes] = useState<SystemCode[]>([]);
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [accounts, setAccounts] = useState<UserDto[]>([]);

  // Form State
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(
    null,
  );
  const [draft, setDraft] = useState<Partial<
    SystemCode &
      AssetGroup &
      AssetUnit &
      AssetType &
      AssetManufacturer &
      WarehouseCategory
  > | null>(null);

  useEffect(() => {
    categoryService
      .getSystemCodes(0, 5000)
      .then((res) => setSystemCodes(res.items || []))
      .catch(console.error);
    categoryService
      .getAssetGroups(0, 5000)
      .then((res) => setAssetGroups(res.items || []))
      .catch(console.error);
    userService
      .getAll({ skipCount: 0, maxResultCount: 1000 })
      .then((res) => setAccounts(res.data || []))
      .catch(console.error);
  }, [refreshTrigger]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  // ---- CRUD Handlers ----
  const handleOpenAdd = () => {
    setDraft({
      code: '',
      name: '',
      description: '',
      address: '',
      phone: '',
      parentId: null,
      systemCodeId: null,
    });
    setModalMode('add');
  };

  const handleOpenView = (
    item: AssetUnit | AssetType | AssetManufacturer | WarehouseCategory,
  ) => {
    setDraft(item);
    setModalMode('view');
  };

  const handleOpenEdit = (
    item: AssetUnit | AssetType | AssetManufacturer | WarehouseCategory,
  ) => {
    setDraft(item);
    setModalMode('edit');
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setDraft(null);
  };

  const handleSave = async () => {
    if (!draft || !draft.code || !draft.name) {
      enqueueSnackbar('Vui lòng nhập đầy đủ Mã và Tên bắt buộc', {
        variant: 'warning',
      });
      return;
    }

    try {
      if (modalMode === 'add') {
        if (tabIndex === 0) await categoryService.createSystemCode(draft);
        else if (tabIndex === 1) await categoryService.createAssetGroup(draft);
        else if (tabIndex === 2) await categoryService.createAssetUnit(draft);
        else if (tabIndex === 3) await categoryService.createAssetType(draft);
        else if (tabIndex === 4)
          await categoryService.createAssetManufacturer(draft);
        else if (tabIndex === 5)
          await categoryService.createWarehouseCategory(draft);
        enqueueSnackbar('Thêm mới thành công', { variant: 'success' });
      } else if (modalMode === 'edit') {
        if (tabIndex === 0) await categoryService.updateSystemCode(draft);
        else if (tabIndex === 1) await categoryService.updateAssetGroup(draft);
        else if (tabIndex === 2) await categoryService.updateAssetUnit(draft);
        else if (tabIndex === 3) await categoryService.updateAssetType(draft);
        else if (tabIndex === 4)
          await categoryService.updateAssetManufacturer(draft);
        else if (tabIndex === 5)
          await categoryService.updateWarehouseCategory(draft);
        enqueueSnackbar('Cập nhật thành công', { variant: 'success' });
      }
      handleCloseModal();
      setRefreshTrigger((prev) => prev + 1);
    } catch (_e) {
      enqueueSnackbar('Có lỗi xảy ra khi lưu dữ liệu', { variant: 'error' });
    }
  };

  const handleDelete = async (
    item:
      | SystemCode
      | AssetGroup
      | AssetUnit
      | AssetType
      | AssetManufacturer
      | WarehouseCategory,
  ) => {
    if (confirm('Bạn có chắc chắn muốn xoá mục này?')) {
      try {
        if (tabIndex === 0 && item.id)
          await categoryService.deleteSystemCode(item.id);
        else if (tabIndex === 1 && item.id)
          await categoryService.deleteAssetGroup(item.id);
        else if (tabIndex === 2 && item.id)
          await categoryService.deleteAssetUnit(item.id);
        else if (tabIndex === 3 && item.id)
          await categoryService.deleteAssetType(item.id);
        else if (tabIndex === 4 && item.id)
          await categoryService.deleteAssetManufacturer(item.id);
        else if (tabIndex === 5 && item.id)
          await categoryService.deleteWarehouseCategory(item.id);

        enqueueSnackbar('Xoá thành công', { variant: 'success' });
        setRefreshTrigger((prev) => prev + 1);
      } catch (_e) {
        enqueueSnackbar('Có lỗi xảy ra khi xoá', { variant: 'error' });
      }
    }
  };

  const handleExportExcel = async () => {
    let exportData: Array<
      AssetGroup & AssetUnit & AssetType & AssetManufacturer & WarehouseCategory
    > = [];
    let title = '';
    let sheetName = '';
    let headers: string[] = [];

    try {
      if (tabIndex === 0) {
        const res = await categoryService.getSystemCodes(0, 5000);
        exportData = res.items.filter(
          (item) =>
            (item.code || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.name || '').toLowerCase().includes(search.toLowerCase()),
        );
        title = 'DanhSach_MaHeTHong';
        sheetName = 'Mã hệ thống';
        headers = ['Mã hệ thống', 'Tên hệ thống', 'Mô tả'];
      } else if (tabIndex === 1) {
        const res = await categoryService.getAssetGroups(0, 5000);
        exportData = res.items.filter(
          (item) =>
            (item.code || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.name || '').toLowerCase().includes(search.toLowerCase()),
        );
        title = 'DanhSach_NhomTaiSan';
        sheetName = 'Nhóm tài sản';
        headers = ['Mã nhóm', 'Tên nhóm', 'Mã hệ thống', 'Nhóm cha', 'Mô tả'];
      } else if (tabIndex === 2) {
        const res = await categoryService.getAssetUnits(0, 5000);
        exportData = res.items.filter(
          (item) =>
            (item.code || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.name || '').toLowerCase().includes(search.toLowerCase()),
        );
        title = 'DanhSach_DonViTaiSan';
        sheetName = 'Đơn vị tài sản';
        headers = ['Mã', 'Tên', 'Mô tả'];
      } else if (tabIndex === 3) {
        const res = await categoryService.getAssetTypes(0, 5000);
        exportData = res.items.filter(
          (item) =>
            (item.code || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.name || '').toLowerCase().includes(search.toLowerCase()),
        );
        title = 'DanhSach_LoaiTaiSan';
        sheetName = 'Loại tài sản';
        headers = ['Mã', 'Tên', 'Mô tả'];
      } else if (tabIndex === 4) {
        const res = await categoryService.getAssetManufacturers(0, 5000);
        exportData = res.items.filter(
          (item) =>
            (item.code || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.name || '').toLowerCase().includes(search.toLowerCase()),
        );
        title = 'DanhSach_NhaSanXuat';
        sheetName = 'Nhà sản xuất';
        headers = ['Mã', 'Tên', 'Mô tả', 'Địa chỉ', 'Số điện thoại'];
      } else if (tabIndex === 5) {
        const res = await categoryService.getWarehouseCategories(0, 5000);
        exportData = res.items.filter(
          (item) =>
            (item.code || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.name || '').toLowerCase().includes(search.toLowerCase()),
        );
        title = 'DanhSach_Kho';
        sheetName = 'Danh mục kho';
        headers = ['Mã kho', 'Tên kho', 'Vị trí', 'Người quản lý', 'Mô tả'];
      }

      if (!exportData || exportData.length === 0) {
        enqueueSnackbar('Không có dữ liệu để xuất', { variant: 'warning' });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(sheetName);

      // Define thin border style
      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      // Add header row
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 12 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD9E1F2' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = thinBorder;
      });

      // Add data rows
      exportData.forEach((item) => {
        let rowData: string[] = [
          item.code || '',
          item.name || '',
          item.description || '',
        ];
        if (tabIndex === 1) {
          rowData.splice(
            2,
            0,
            (item as AssetGroup).systemCodeCode || '',
            (item as AssetGroup).parentName || '',
          );
        } else if (tabIndex === 4) {
          rowData.push(
            (item as AssetManufacturer).address || '',
            (item as AssetManufacturer).phone || '',
          );
        } else if (tabIndex === 5) {
          const manager = accounts.find(
            (a) => a.id === (item as WarehouseCategory).managerId,
          );
          let managerName = '';
          if (manager) {
            managerName =
              manager.fullName || manager.name || manager.userName || '';
            if (
              manager.name &&
              manager.surname &&
              manager.name === manager.surname
            ) {
              managerName = manager.name;
            } else if (
              managerName.includes(manager.name) &&
              managerName.includes(manager.surname)
            ) {
              const half1 = managerName
                .substring(0, managerName.length / 2)
                .trim();
              const half2 = managerName
                .substring(managerName.length / 2)
                .trim();
              if (half1 === half2) {
                managerName = half1;
              }
            }
            managerName = `${managerName} (${manager.userName})`;
          }
          rowData = [
            item.code || '',
            item.name || '',
            (item as WarehouseCategory).location || '',
            managerName,
            item.description || '',
          ];
        }
        const row = worksheet.addRow(rowData);
        row.eachCell((cell) => {
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle' };
        });
      });

      // Auto-fit column widths
      worksheet.columns.forEach((column) => {
        let maxLength = 10;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const cellLength = cell.value ? String(cell.value).length : 0;
          if (cellLength > maxLength) maxLength = cellLength;
        });
        column.width = Math.min(maxLength + 4, 50);
      });

      // Export as .xlsx
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${title}_${new Date().getTime()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      enqueueSnackbar('Xuất file thành công', { variant: 'success' });
    } catch (_e) {
      enqueueSnackbar('Đã có lỗi xảy ra khi xuất file', { variant: 'error' });
    }
  };

  const getFormTitle = () => {
    const action =
      modalMode === 'add'
        ? 'Thêm mới'
        : modalMode === 'view'
          ? 'Chi tiết'
          : 'Sửa';
    if (tabIndex === 0) return `${action} Mã hệ thống`;
    if (tabIndex === 1) return `${action} Nhóm tài sản`;
    if (tabIndex === 2) return `${action} Đơn vị tài sản`;
    if (tabIndex === 3) return `${action} Loại tài sản`;
    if (tabIndex === 4) return `${action} Nhà sản xuất`;
    if (tabIndex === 5) return `${action} Danh mục kho`;
    return action;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        position: 'absolute',
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
          Quản lý Danh mục Tài sản
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
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
          <Button
            onClick={handleExportExcel}
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            sx={{
              color: '#d1d5db',
              borderColor: 'rgba(255,255,255,0.15)',
              fontWeight: 500,
              textTransform: 'none',
              borderRadius: 2,
              px: 3,
              py: 1,
              bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.3)',
                bgcolor: 'rgba(255,255,255,0.05)',
              },
            }}
          >
            Xuất Excel
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
        <TextField
          fullWidth
          placeholder="Tìm kiếm..."
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
        {tabIndex < 2 && (
          <Button
            variant="outlined"
            startIcon={<FilterAltOutlinedIcon />}
            sx={{
              color: '#d1d5db',
              borderColor: 'rgba(255,255,255,0.15)',
              fontWeight: 500,
              textTransform: 'none',
              borderRadius: 2,
              px: 3,
              minWidth: 100,
              height: '46px',
              bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.3)',
                bgcolor: 'rgba(255,255,255,0.05)',
              },
            }}
          >
            Lọc
          </Button>
        )}
      </Box>

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
        <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            sx={{
              minHeight: 50,
              px: 2,
              '& .MuiTabs-indicator': { backgroundColor: '#00B8DB', height: 2 },
              '& .MuiTab-root': {
                textTransform: 'none',
                color: '#9ca3af',
                fontWeight: 500,
                fontSize: 14,
                minHeight: 50,
                pt: 1.5,
                pb: 1.5,
                px: 3,
                '&.Mui-selected': { color: '#00B8DB', fontWeight: 600 },
              },
            }}
          >
            <Tab disableRipple label="Mã hệ thống" />
            <Tab disableRipple label="Nhóm tài sản" />
            <Tab disableRipple label="Đơn vị tài sản" />
            <Tab disableRipple label="Loại tài sản" />
            <Tab disableRipple label="Nhà sản xuất" />
            <Tab disableRipple label="Danh mục kho" />
          </Tabs>
        </Box>

        {tabIndex === 0 && (
          <SystemCodeTab
            search={search}
            refreshTrigger={refreshTrigger}
            onView={handleOpenView}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
          />
        )}
        {tabIndex === 1 && (
          <AssetGroupTab
            search={search}
            refreshTrigger={refreshTrigger}
            onView={handleOpenView}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
          />
        )}
        {tabIndex === 2 && (
          <AssetUnitTab
            search={search}
            refreshTrigger={refreshTrigger}
            onView={handleOpenView}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
          />
        )}
        {tabIndex === 3 && (
          <AssetTypeTab
            search={search}
            refreshTrigger={refreshTrigger}
            onView={handleOpenView}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
          />
        )}
        {tabIndex === 4 && (
          <AssetManufacturerTab
            search={search}
            refreshTrigger={refreshTrigger}
            onView={handleOpenView}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
          />
        )}
        {tabIndex === 5 && (
          <WarehouseCategoryTab
            search={search}
            refreshTrigger={refreshTrigger}
            onView={handleOpenView}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
          />
        )}
      </Box>

      {/* Add / Edit Modal */}
      <Dialog
        open={!!modalMode}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0d1b2e',
            border: '1px solid rgba(0,200,255,0.15)',
            borderRadius: 3,
            boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
          },
        }}
        sx={{ '& .MuiDialog-container': { alignItems: 'center' } }}
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
            {getFormTitle()}
          </Typography>
          <Box
            component="button"
            onClick={handleCloseModal}
            sx={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              p: 0.5,
              '&:hover': { color: '#94a3b8' },
            }}
          >
            <X size={20} />
          </Box>
        </Box>

        <Box
          sx={{
            px: 3,
            pb: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
          }}
        >
          {/* Default Fields */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
                Mã{' '}
                {modalMode !== 'view' && (
                  <span style={{ color: '#ef4444' }}>*</span>
                )}
              </Typography>
              <input
                style={{
                  ...fieldStyle,
                  border:
                    !draft?.code && modalMode !== 'view'
                      ? '1px solid rgba(239,68,68,0.5)'
                      : '1px solid rgba(255,255,255,0.12)',
                  opacity:
                    modalMode === 'edit' || modalMode === 'view' ? 0.7 : 1,
                }}
                value={draft?.code ?? ''}
                readOnly={modalMode === 'edit' || modalMode === 'view'}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, code: e.target.value } : d))
                }
                onFocus={(e) => {
                  if (modalMode === 'add')
                    e.target.style.borderColor = '#00c8ff';
                }}
                onBlur={(e) => {
                  if (!draft?.code) {
                    e.target.style.borderColor = 'rgba(239,68,68,0.5)';
                  } else {
                    e.target.style.borderColor = 'rgba(255,255,255,0.12)';
                  }
                }}
              />
            </Box>
            <Box sx={{ flex: 2 }}>
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
                  setDraft((d) => (d ? { ...d, name: e.target.value } : d))
                }
                onFocus={(e) => {
                  if (modalMode !== 'view')
                    e.target.style.borderColor = '#00c8ff';
                }}
                onBlur={(e) => {
                  if (!draft?.name) {
                    e.target.style.borderColor = 'rgba(239,68,68,0.5)';
                  } else {
                    e.target.style.borderColor = 'rgba(255,255,255,0.12)';
                  }
                }}
              />
            </Box>
          </Box>

          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
              Mô tả
            </Typography>
            <textarea
              style={{
                ...fieldStyle,
                minHeight: '80px',
                resize: 'vertical',
                opacity: modalMode === 'view' ? 0.7 : 1,
              }}
              value={draft?.description ?? ''}
              readOnly={modalMode === 'view'}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, description: e.target.value } : d))
              }
              onFocus={(e) => {
                if (modalMode !== 'view')
                  e.target.style.borderColor = '#00c8ff';
              }}
              onBlur={(e) =>
                (e.target.style.borderColor = 'rgba(255,255,255,0.12)')
              }
            />
          </Box>

          {/* AssetGroup Specific Fields: Nhóm cha + Mã hệ thống */}
          {tabIndex === 1 && (
            <>
              <Box>
                <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
                  Mã hệ thống
                </Typography>
                <select
                  disabled={modalMode === 'view'}
                  style={{
                    ...fieldStyle,
                    opacity: modalMode === 'view' ? 0.7 : 1,
                    cursor: modalMode === 'view' ? 'not-allowed' : 'pointer',
                  }}
                  value={draft?.systemCodeId ?? ''}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            systemCodeId: e.target.value
                              ? Number(e.target.value)
                              : null,
                          }
                        : d,
                    )
                  }
                >
                  <option value="" style={{ background: '#0d1b2e' }}>
                    -- Không chọn --
                  </option>
                  {systemCodes.map((sc) => (
                    <option
                      key={sc.id}
                      value={sc.id}
                      style={{ background: '#0d1b2e' }}
                    >
                      {sc.code} – {sc.name}
                    </option>
                  ))}
                </select>
              </Box>
              <Box>
                <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
                  Nhóm cha
                </Typography>
                <select
                  disabled={modalMode === 'view'}
                  style={{
                    ...fieldStyle,
                    opacity: modalMode === 'view' ? 0.7 : 1,
                    cursor: modalMode === 'view' ? 'not-allowed' : 'pointer',
                  }}
                  value={draft?.parentId ?? ''}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            parentId: e.target.value
                              ? Number(e.target.value)
                              : null,
                          }
                        : d,
                    )
                  }
                >
                  <option value="" style={{ background: '#0d1b2e' }}>
                    -- Nhóm gốc (không có cha) --
                  </option>
                  {assetGroups
                    .filter((g) => g.id !== draft?.id)
                    .map((g) => (
                      <option
                        key={g.id}
                        value={g.id}
                        style={{ background: '#0d1b2e' }}
                      >
                        {g.code} – {g.name}
                      </option>
                    ))}
                </select>
              </Box>
            </>
          )}

          {/* Manufacturer Specific Fields */}
          {tabIndex === 4 && (
            <>
              <Box>
                <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
                  Địa chỉ
                </Typography>
                <input
                  style={{
                    ...fieldStyle,
                    opacity: modalMode === 'view' ? 0.7 : 1,
                  }}
                  value={draft?.address ?? ''}
                  readOnly={modalMode === 'view'}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, address: e.target.value } : d))
                  }
                  onFocus={(e) => {
                    if (modalMode !== 'view')
                      e.target.style.borderColor = '#00c8ff';
                  }}
                  onBlur={(e) =>
                    (e.target.style.borderColor = 'rgba(255,255,255,0.12)')
                  }
                />
              </Box>
              <Box>
                <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
                  Số điện thoại
                </Typography>
                <input
                  style={{
                    ...fieldStyle,
                    opacity: modalMode === 'view' ? 0.7 : 1,
                  }}
                  value={draft?.phone ?? ''}
                  readOnly={modalMode === 'view'}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, phone: e.target.value } : d))
                  }
                  onFocus={(e) => {
                    if (modalMode !== 'view')
                      e.target.style.borderColor = '#00c8ff';
                  }}
                  onBlur={(e) =>
                    (e.target.style.borderColor = 'rgba(255,255,255,0.12)')
                  }
                />
              </Box>
            </>
          )}

          {/* WarehouseCategory Specific Fields */}
          {tabIndex === 5 && (
            <>
              <Box>
                <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
                  Vị trí
                </Typography>
                <input
                  style={{
                    ...fieldStyle,
                    opacity: modalMode === 'view' ? 0.7 : 1,
                  }}
                  value={draft?.location ?? ''}
                  readOnly={modalMode === 'view'}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, location: e.target.value } : d,
                    )
                  }
                  onFocus={(e) => {
                    if (modalMode !== 'view')
                      e.target.style.borderColor = '#00c8ff';
                  }}
                  onBlur={(e) =>
                    (e.target.style.borderColor = 'rgba(255,255,255,0.12)')
                  }
                />
              </Box>
              <Box>
                <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>
                  Người quản lý (Thủ kho)
                </Typography>
                <select
                  disabled={modalMode === 'view'}
                  style={{
                    ...fieldStyle,
                    opacity: modalMode === 'view' ? 0.7 : 1,
                    cursor: modalMode === 'view' ? 'not-allowed' : 'pointer',
                  }}
                  value={draft?.managerId ?? ''}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            managerId: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }
                        : d,
                    )
                  }
                >
                  <option value="" style={{ background: '#0d1b2e' }}>
                    -- Không chọn --
                  </option>
                  {accounts.map((acc) => {
                    // Xử lý lỗi name bị lặp đôi từ ABP (do Name và Surname giống nhau)
                    let displayName =
                      acc.fullName || acc.name || acc.userName || '';
                    if (acc.name && acc.surname && acc.name === acc.surname) {
                      displayName = acc.name;
                    } else if (
                      displayName.includes(acc.name) &&
                      displayName.includes(acc.surname)
                    ) {
                      const half1 = displayName
                        .substring(0, displayName.length / 2)
                        .trim();
                      const half2 = displayName
                        .substring(displayName.length / 2)
                        .trim();
                      if (half1 === half2) {
                        displayName = half1;
                      }
                    }
                    return (
                      <option
                        key={acc.id}
                        value={acc.id}
                        style={{ background: '#0d1b2e' }}
                      >
                        {displayName} ({acc.userName})
                      </option>
                    );
                  })}
                </select>
              </Box>
            </>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, pt: 2, px: 3, pb: 3 }}>
          {modalMode !== 'view' && (
            <Box
              component="button"
              onClick={handleSave}
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                py: 1.25,
                borderRadius: 2,
                border: 'none',
                bgcolor: '#00c8ff',
                color: '#020617',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: '#00e5ff' },
              }}
            >
              <Save size={16} /> Lưu thông tin
            </Box>
          )}
          <Box
            component="button"
            onClick={handleCloseModal}
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              py: 1.25,
              borderRadius: 2,
              border: 'none',
              bgcolor: 'rgba(255,255,255,0.1)',
              color: '#f1f5f9',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
              },
            }}
          >
            {modalMode === 'view' ? 'Đóng' : 'Hủy bỏ'}
          </Box>
        </Box>
      </Dialog>
    </motion.div>
  );
};

export default AssetCategoryPanel;
