import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
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
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { X, ImageIcon } from 'lucide-react';
import ExcelJS from 'exceljs';
import dayjs from 'dayjs';

import type { AssetLog } from '@/services/ioc/assetLog.service';
import { assetLogService } from '@/services/ioc/assetLog.service';
import { DateInput } from '@/components/field/DateInput';
import { SearchableSelect } from '@/components/field/SearchableSelect';
import { userService } from '@/pages/smart-building/services/user.service';
import type { UserDto } from '@/pages/smart-building/services/user.service';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

interface AssetLogTableProps {
  assetDetailId: number;
}

const STATUSES = [
  { value: 1, label: 'Tốt/Bình thường', color: '#22c55e' },
  { value: 2, label: 'Cần bảo trì', color: '#eab308' },
  { value: 3, label: 'Khấu hao/Hỏng', color: '#ef4444' },
];

export const AssetLogTable = ({ assetDetailId }: AssetLogTableProps) => {
  const [data, setData] = useState<AssetLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { enqueueSnackbar } = useSnackbar();

  // Menu action
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<AssetLog | null>(null);

  // Modal thêm/sửa/xem
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [draft, setDraft] = useState<AssetLog | null>(null);

  // Image
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setImagePreview(url);
      setDraft((d) => d ? { ...d, images: url } : d);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setDraft((d) => d ? { ...d, images: '' } : d);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [accounts, setAccounts] = useState<UserDto[]>([]);
  useEffect(() => {
    userService.getAll({ skipCount: 0, maxResultCount: 1000 }).then(res => setAccounts(res.data || [])).catch(console.error);
  }, []);

  const getCheckerName = (id?: number | null) => {
    if (!id) return '';
    const acc = accounts.find(a => a.id === id);
    if (!acc) return String(id);
    let displayName = acc.fullName || acc.name || acc.userName || '';
    if (acc.name && acc.surname && acc.name === acc.surname) {
      displayName = acc.name;
    } else if (displayName.includes(acc.name) && displayName.includes(acc.surname)) {
      const half1 = displayName.substring(0, displayName.length / 2).trim();
      const half2 = displayName.substring(displayName.length / 2).trim();
      if (half1 === half2) {
        displayName = half1;
      }
    }
    return `${displayName}`;
  };

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (!assetDetailId) return;
      setLoading(true);
      try {
        const res = await assetLogService.getAssetLogs(
          page * rowsPerPage,
          rowsPerPage,
          assetDetailId
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
    fetchData();
    return () => {
      active = false;
    };
  }, [assetDetailId, page, rowsPerPage, refreshTrigger]);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, row: AssetLog) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };
  const handleCloseMenu = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const handleOpenAdd = () => {
    setDraft({
      assetDetailId,
      content: '',
      status: 1,
      createDate: new Date(),
      images: ''
    });
    setImagePreview(null);
    setModalMode('add');
  };

  const handleOpenEdit = (item: AssetLog) => {
    setDraft(item);
    setImagePreview(item.images || null);
    setModalMode('edit');
  };

  const handleOpenView = (item: AssetLog) => {
    setDraft(item);
    setImagePreview(item.images || null);
    setModalMode('view');
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setDraft(null);
    setImagePreview(null);
  };

  const handleSave = async () => {
    if (!draft || !draft.content) {
      enqueueSnackbar('Vui lòng nhập nội dung nhật ký', { variant: 'warning' });
      return;
    }
    try {
      if (modalMode === 'edit' && draft.id) {
        await assetLogService.updateAssetLog(draft);
        enqueueSnackbar('Cập nhật thành công', { variant: 'success' });
      } else {
        await assetLogService.createAssetLog(draft);
        enqueueSnackbar('Thêm mới thành công', { variant: 'success' });
      }
      handleCloseModal();
      setRefreshTrigger((prev) => prev + 1);
    } catch (_e) {
      enqueueSnackbar('Có lỗi xảy ra khi lưu dữ liệu', { variant: 'error' });
    }
  };

  const handleDelete = async (item: AssetLog) => {
    if (confirm('Bạn có chắc chắn muốn xoá nhật ký này?')) {
      try {
        if (item.id) await assetLogService.deleteAssetLog(item.id);
        enqueueSnackbar('Xoá thành công', { variant: 'success' });
        setRefreshTrigger((prev) => prev + 1);
      } catch (_e) {
        enqueueSnackbar('Có lỗi xảy ra khi xoá', { variant: 'error' });
      }
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await assetLogService.getAssetLogs(0, 5000, assetDetailId);
      const exportData = res.items || [];
      if (exportData.length === 0) {
        enqueueSnackbar('Không có dữ liệu để xuất', { variant: 'warning' });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Nhật ký tài sản');
      const headers = ['Ngày tạo', 'Người kiểm tra/Thực hiện', 'Ngày sửa chữa', 'Ngày kiểm định', 'Nội dung', 'Trạng thái'];

      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 12 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      exportData.forEach((item) => {
        const row = worksheet.addRow([
          item.createDate ? dayjs(item.createDate).format('DD/MM/YYYY') : '',
          getCheckerName(item.checkerId),
          item.repairDate ? dayjs(item.repairDate).format('DD/MM/YYYY') : '',
          item.checklistDate ? dayjs(item.checklistDate).format('DD/MM/YYYY') : '',
          item.content || '',
          STATUSES.find(x => x.value === item.status)?.label || '',
        ]);
        row.eachCell((cell) => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { vertical: 'middle', wrapText: true };
        });
      });

      worksheet.columns.forEach((column) => {
        column.width = 20;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `NhatKyTaiSan_${new Date().getTime()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      enqueueSnackbar('Xuất file thành công', { variant: 'success' });
    } catch (_e) {
      enqueueSnackbar('Đã có lỗi xảy ra khi xuất file', { variant: 'error' });
    }
  };

  const fetchCheckerOptions = async (keyword: string) => {
    try {
      const res = await userService.getAll({ keyword, skipCount: 0, maxResultCount: 20 });
      if (res && res.data) {
        return res.data.map(x => {
          let displayName = x.fullName || x.name || x.userName || 'Không tên';
          if (x.name && x.surname && x.name === x.surname) {
             displayName = x.name;
          } else if (displayName.includes(x.name) && displayName.includes(x.surname)) {
             const half1 = displayName.substring(0, displayName.length / 2).trim();
             const half2 = displayName.substring(displayName.length / 2).trim();
             if (half1 === half2) {
                 displayName = half1;
             }
          }
          return { label: `${displayName} (${x.userName})`, value: x.id };
        });
      }
      return [];
    } catch {
      return [];
    }
  };

  const getStatusLabel = (status?: number) => STATUSES.find(x => x.value === status)?.label || '';
  const getStatusColor = (status?: number) => STATUSES.find(x => x.value === status)?.color || '#9ca3af';

  const fieldStyle = {
    width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.03)", color: "#f1f5f9", fontSize: "14px", outline: "none",
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          onClick={handleExportExcel}
          variant="outlined" startIcon={<FileDownloadOutlinedIcon />}
          sx={{ color: '#d1d5db', borderColor: 'rgba(255,255,255,0.15)', textTransform: 'none', borderRadius: 2 }}
        >
          Xuất Excel
        </Button>
        <Button
          onClick={handleOpenAdd}
          variant="contained" startIcon={<AddIcon />}
          sx={{ bgcolor: '#00B8DB', color: '#fff', textTransform: 'none', borderRadius: 2 }}
        >
          Thêm nhật ký
        </Button>
      </Box>

      <Box sx={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, bgcolor: 'rgba(15, 23, 42, 0.4)', overflow: 'hidden' }}>
        <TableContainer>
        {loading && data.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#00B8DB' }} /></Box>
        ) : (
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600, bgcolor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>THỜI GIAN TẠO</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600, bgcolor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>NGƯỜI KIỂM TRA</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600, bgcolor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>NỘI DUNG</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600, bgcolor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>TRẠNG THÁI</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600, bgcolor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.08)' }} align="right">HÀNH ĐỘNG</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell sx={{ color: '#e5e7eb', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{row.createDate ? dayjs(row.createDate).format('DD/MM/YYYY') : ''}</TableCell>
                  <TableCell sx={{ color: '#e5e7eb', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{getCheckerName(row.checkerId)}</TableCell>
                  <TableCell sx={{ color: '#e5e7eb', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{row.content}</TableCell>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <Box sx={{ display: 'inline-block', px: 1.5, py: 0.5, borderRadius: 1, bgcolor: `${getStatusColor(row.status)}15`, color: getStatusColor(row.status), fontSize: 12 }}>
                      {getStatusLabel(row.status)}
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <IconButton size="small" onClick={(e) => handleOpenMenu(e, row)} sx={{ color: '#9ca3af' }}><MoreVertIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography sx={{ color: '#9ca3af' }}>Chưa có nhật ký nào</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
        </TableContainer>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>Số hàng mỗi trang:</Typography>
          <Select
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value={rowsPerPage} onChange={(e: any) => { setRowsPerPage(e.target.value as number); setPage(0); }}
            size="small" sx={{ color: '#fff', fontSize: 13, height: 32, bgcolor: 'rgba(255,255,255,0.02)', '& .MuiSelect-icon': { color: '#9ca3af' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
          >
            <MenuItem value={10}>10</MenuItem><MenuItem value={20}>20</MenuItem><MenuItem value={50}>50</MenuItem>
          </Select>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>{totalCount === 0 ? '0-0 trên 0' : `${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, totalCount)} trên ${totalCount}`}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" disabled={page === 0} onClick={() => setPage(page - 1)} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.15)', bgcolor: 'rgba(255,255,255,0.02)', textTransform: 'none', minWidth: 'unset', px: 2, py: 0.5, '&.Mui-disabled': { color: '#6b7280', borderColor: 'rgba(255,255,255,0.05)' } }}>Trước</Button>
            <Button variant="outlined" disabled={(page + 1) * rowsPerPage >= totalCount} onClick={() => setPage(page + 1)} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.15)', bgcolor: 'rgba(255,255,255,0.02)', textTransform: 'none', minWidth: 'unset', px: 2, py: 0.5, '&.Mui-disabled': { color: '#6b7280', borderColor: 'rgba(255,255,255,0.05)' } }}>Sau</Button>
          </Box>
        </Box>
        </Box>
      </Box>

      <Menu
        anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}
        PaperProps={{ sx: { bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, minWidth: 160 } }}
      >
        <MenuItem onClick={() => { handleCloseMenu(); if (selectedRow) handleOpenView(selectedRow); }} sx={{ color: '#e2e8f0' }}><VisibilityOutlinedIcon sx={{ mr: 2, fontSize: 20 }} /> Xem chi tiết</MenuItem>
        <MenuItem onClick={() => { handleCloseMenu(); if (selectedRow) handleOpenEdit(selectedRow); }} sx={{ color: '#e2e8f0' }}><EditOutlinedIcon sx={{ mr: 2, fontSize: 20 }} /> Chỉnh sửa</MenuItem>
        <MenuItem onClick={() => { handleCloseMenu(); if (selectedRow) handleDelete(selectedRow); }} sx={{ color: '#ef4444' }}><DeleteOutlineIcon sx={{ mr: 2, fontSize: 20 }} /> Xoá</MenuItem>
      </Menu>

      <Dialog open={Boolean(modalMode)} onClose={handleCloseModal} maxWidth="sm" fullWidth disableEnforceFocus
        PaperProps={{ sx: { bgcolor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography sx={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>{modalMode === 'add' ? 'Thêm Nhật ký' : modalMode === 'view' ? 'Chi tiết Nhật ký' : 'Sửa Nhật ký'}</Typography>
          <Box component="button" onClick={handleCloseModal} sx={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></Box>
        </Box>
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Thời gian tạo</Typography>
              <DateInput
                style={fieldStyle}
                readOnly={modalMode === 'view'}
                value={draft?.createDate}
                onChange={(val) => setDraft((d) => d ? { ...d, createDate: val } : d)}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Trạng thái</Typography>
              <select
                disabled={modalMode === 'view'}
                style={{ ...fieldStyle, cursor: modalMode === 'view' ? 'not-allowed' : 'pointer', opacity: modalMode === 'view' ? 0.7 : 1 }}
                value={draft?.status ?? 1}
                onChange={(e) => setDraft((d) => d ? { ...d, status: Number(e.target.value) } : d)}
              >
                {STATUSES.map(s => <option key={s.value} value={s.value} style={{ background: '#0d1b2e' }}>{s.label}</option>)}
              </select>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Ngày sửa chữa</Typography>
              <DateInput
                style={fieldStyle}
                readOnly={modalMode === 'view'}
                value={draft?.repairDate}
                onChange={(val) => setDraft((d) => d ? { ...d, repairDate: val } : d)}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Ngày kiểm định</Typography>
              <DateInput
                style={fieldStyle}
                readOnly={modalMode === 'view'}
                value={draft?.checklistDate}
                onChange={(val) => setDraft((d) => d ? { ...d, checklistDate: val } : d)}
              />
            </Box>
          </Box>
          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Người kiểm tra</Typography>
            <SearchableSelect
              style={fieldStyle}
              disabled={modalMode === 'view'}
              fetchOptions={fetchCheckerOptions}
              value={draft?.checkerId ?? 0}
              onChange={(val) => setDraft((d) => d ? { ...d, checkerId: val ? Number(val) : null } : d)}
              placeholder="Tìm chọn người kiểm tra..."
            />
          </Box>
          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Nội dung chi tiết <span style={{ color: '#ef4444' }}>*</span></Typography>
            <textarea
              readOnly={modalMode === 'view'}
              style={{ ...fieldStyle, minHeight: '100px', resize: 'vertical', opacity: modalMode === 'view' ? 0.7 : 1, cursor: modalMode === 'view' ? 'not-allowed' : 'text' }}
              value={draft?.content ?? ''}
              onChange={(e) => setDraft((d) => d ? { ...d, content: e.target.value } : d)}
              placeholder="Nhập nội dung nhật ký, bảo dưỡng, kiểm tra..."
            />
          </Box>
          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 1 }}>Hình ảnh</Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />
            {imagePreview ? (
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Box
                  component="img"
                  src={imagePreview}
                  alt="Ảnh minh họa"
                  sx={{
                    width: 160,
                    height: 160,
                    objectFit: 'cover',
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                />
                {modalMode !== 'view' && (
                  <Box
                    component="button"
                    onClick={handleRemoveImage}
                    sx={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: 'rgba(239,68,68,0.9)',
                      border: 'none',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      p: 0,
                      '&:hover': { bgcolor: '#ef4444' },
                    }}
                  >
                    <X size={14} />
                  </Box>
                )}
              </Box>
            ) : (
              <Box
                onClick={() => { if (modalMode !== 'view') fileInputRef.current?.click(); }}
                sx={{
                  width: 160,
                  height: 160,
                  border: `2px dashed rgba(255,255,255,${modalMode === 'view' ? '0.05' : '0.15'})`,
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  bgcolor: modalMode === 'view' ? 'rgba(0,0,0,0.1)' : 'transparent',
                  cursor: modalMode === 'view' ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': modalMode !== 'view' ? {
                    borderColor: 'rgba(0,200,255,0.4)',
                    bgcolor: 'rgba(0,200,255,0.05)',
                  } : {},
                }}
              >
                <ImageIcon size={28} color={modalMode === 'view' ? '#475569' : '#64748b'} />
                <Typography sx={{ color: modalMode === 'view' ? '#475569' : '#64748b', fontSize: 13 }}>
                  {modalMode === 'view' ? 'Không có ảnh' : 'Thêm hình ảnh'}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
        <Box sx={{ p: 3, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button onClick={handleCloseModal} sx={{ color: '#94a3b8', textTransform: 'none' }}>{modalMode === 'view' ? 'Đóng' : 'Huỷ bỏ'}</Button>
          {modalMode !== 'view' && (
            <Button onClick={handleSave} variant="contained" sx={{ bgcolor: '#00B8DB', color: '#fff', textTransform: 'none' }}>Lưu dữ liệu</Button>
          )}
        </Box>
      </Dialog>

    </Box>
  );
};
