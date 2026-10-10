import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ArrowRight,
  GitBranch,
  Link2,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useBuilding } from '@/contexts/BuildingContext';
import deviceService from '@/services/building-device/device.service';
import deviceRuleService, {
  type CreateDeviceRuleDto,
  type DeviceRule,
  type RuleType,
} from '@/services/building-device/device-rule.service';
import type { IDevice } from '@/services/building-device/device.model';

/* ─── Device type colors (reuse from sidebar) ─── */
const DEVICE_TYPE_COLORS: Record<string, string> = {
  FAN: '#3b82f6', PUMP: '#06b6d4', FIRE_PUMP: '#ef4444', FIRE_ALARM: '#f59e0b',
  LIGHT: '#eab308', DIM_LIGHT: '#ca8a04', AHU: '#8b5cf6', FCU: '#14b8a6',
  VAV: '#f97316', PAU: '#a78bfa', CHILLER: '#22d3ee', ELECTRIC: '#fbbf24',
  ELECTRIC_METER: '#f59e0b', POWER_BREAKER: '#f97316',
  CHILLER_VALVE: '#06b6d4', CHILLER_COLD_PUMP: '#06b6d4',
  CHILLER_COOLING_PUMP: '#22d3ee', CHILLER_COOLING_TOWER: '#0ea5e9',
};
const getTypeColor = (type: string) => DEVICE_TYPE_COLORS[type] || '#94a3b8';

/* ─── Rule Card Component ─── */
const RuleCard = ({
  rule,
  onDelete,
  deleting,
}: {
  rule: DeviceRule;
  onDelete: (id: string) => void;
  deleting: boolean;
}) => {
  const isPrerequisite = rule.ruleType === 'PREREQUISITE';
  const accentColor = isPrerequisite ? '#f59e0b' : '#22c55e';
  const Icon = isPrerequisite ? Shield : Zap;

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 3,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.8) 100%)',
        border: `1px solid ${accentColor}25`,
        transition: 'all 0.3s ease',
        '&:hover': {
          border: `1px solid ${accentColor}50`,
          boxShadow: `0 4px 20px ${accentColor}15`,
          transform: 'translateY(-1px)',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 32, height: 32, borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: `${accentColor}20`,
              border: `1px solid ${accentColor}40`,
            }}
          >
            <Icon size={16} color={accentColor} />
          </Box>
          <Box>
            <Chip
              label={isPrerequisite ? 'PREREQUISITE' : 'CASCADE'}
              size="small"
              sx={{
                height: 20, fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                bgcolor: `${accentColor}20`, color: accentColor,
                border: `1px solid ${accentColor}40`,
              }}
            />
          </Box>
        </Box>
        <Tooltip title="Xóa quy tắc">
          <IconButton
            size="small"
            onClick={() => onDelete(rule.id)}
            disabled={deleting}
            sx={{
              color: '#64748b',
              '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' },
            }}
          >
            {deleting ? <CircularProgress size={14} /> : <Trash2 size={14} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Flow: Source → Target */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        {/* Source Device */}
        <Box
          sx={{
            flex: 1, p: 1.5, borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Typography sx={{ fontSize: 9, color: '#64748b', letterSpacing: '0.1em', mb: 0.5 }}>
            {isPrerequisite ? 'THIẾT BỊ CẦN BẬT' : 'NGUỒN (TRIGGER)'}
          </Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
            {rule.sourceDevice?.name || 'N/A'}
          </Typography>
          <Chip
            label={rule.sourceDevice?.type || ''}
            size="small"
            sx={{
              mt: 0.5, height: 18, fontSize: 8,
              bgcolor: `${getTypeColor(rule.sourceDevice?.type || '')}20`,
              color: getTypeColor(rule.sourceDevice?.type || ''),
            }}
          />
        </Box>

        {/* Arrow */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          <ArrowRight size={20} color={accentColor} />
          {!isPrerequisite && rule.triggerOn && (
            <Chip
              label={`${rule.triggerOn}→${rule.targetAction}`}
              size="small"
              sx={{
                height: 16, fontSize: 8, fontWeight: 700,
                bgcolor: 'rgba(34,197,94,0.15)', color: '#22c55e',
              }}
            />
          )}
        </Box>

        {/* Target Device */}
        <Box
          sx={{
            flex: 1, p: 1.5, borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Typography sx={{ fontSize: 9, color: '#64748b', letterSpacing: '0.1em', mb: 0.5 }}>
            {isPrerequisite ? 'PHẢI BẬT TRƯỚC' : 'ĐÍCH (TARGET)'}
          </Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
            {rule.targetDevice?.name || 'N/A'}
          </Typography>
          <Chip
            label={rule.targetDevice?.type || ''}
            size="small"
            sx={{
              mt: 0.5, height: 18, fontSize: 8,
              bgcolor: `${getTypeColor(rule.targetDevice?.type || '')}20`,
              color: getTypeColor(rule.targetDevice?.type || ''),
            }}
          />
        </Box>
      </Box>

      {/* Description + Priority */}
      {rule.description && (
        <Typography sx={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', mt: 1 }}>
          {rule.description}
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
        <Chip
          label={`Ưu tiên: ${rule.priority}`}
          size="small"
          sx={{ height: 18, fontSize: 8, bgcolor: 'rgba(255,255,255,0.05)', color: '#64748b' }}
        />
        <Chip
          label={rule.isActive ? 'Active' : 'Inactive'}
          size="small"
          sx={{
            height: 18, fontSize: 8,
            bgcolor: rule.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: rule.isActive ? '#22c55e' : '#ef4444',
          }}
        />
      </Box>
    </Box>
  );
};

/* ─── Create Rule Dialog ─── */
const CreateRuleDialog = ({
  open,
  onClose,
  devices,
  buildingId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  devices: IDevice[];
  buildingId: number;
  onCreated: (rule: DeviceRule) => void;
}) => {
  const theme = useTheme();
  const [ruleType, setRuleType] = useState<RuleType>('PREREQUISITE');
  const [sourceDeviceId, setSourceDeviceId] = useState('');
  const [targetDeviceId, setTargetDeviceId] = useState('');
  const [triggerOn, setTriggerOn] = useState('ON');
  const [targetAction, setTargetAction] = useState('ON');
  const [priority, setPriority] = useState(0);
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setRuleType('PREREQUISITE');
    setSourceDeviceId('');
    setTargetDeviceId('');
    setTriggerOn('ON');
    setTargetAction('ON');
    setPriority(0);
    setDescription('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (!sourceDeviceId || !targetDeviceId) {
      setError('Vui lòng chọn thiết bị nguồn và thiết bị đích');
      return;
    }
    if (sourceDeviceId === targetDeviceId) {
      setError('Thiết bị nguồn và đích không được giống nhau');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const dto: CreateDeviceRuleDto = {
        buildingId,
        ruleType,
        sourceDeviceId,
        targetDeviceId,
        priority,
        description: description || undefined,
      };
      if (ruleType === 'CASCADE') {
        dto.triggerOn = triggerOn;
        dto.targetAction = targetAction;
      }
      const newRule = await deviceRuleService.createRule(dto);
      onCreated(newRule);
      handleClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Tạo quy tắc thất bại');
    } finally {
      setCreating(false);
    }
  };

  const sourceName = devices.find(d => d.id === sourceDeviceId)?.name;
  const targetName = devices.find(d => d.id === targetDeviceId)?.name;

  const dialogSx = {
    '& .MuiDialog-paper': {
      bgcolor: '#0B1220',
      backgroundImage: 'none',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 3,
      minWidth: 520,
      maxWidth: 600,
    },
  };

  const selectSx = {
    '& .MuiOutlinedInput-root': {
      color: '#e2e8f0', fontSize: 12,
      bgcolor: 'rgba(255,255,255,0.04)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: 'rgba(0,229,255,0.3)' },
      '&.Mui-focused fieldset': { borderColor: '#00e5ff' },
    },
    '& .MuiInputLabel-root': { color: '#64748b', fontSize: 12 },
    '& .MuiInputLabel-root.Mui-focused': { color: '#00e5ff' },
    '& .MuiSelect-icon': { color: '#64748b' },
  };

  const menuSx = {
    PaperProps: {
      sx: {
        bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
        maxHeight: 300,
        '& .MuiMenuItem-root': {
          fontSize: 12, color: '#e2e8f0',
          '&:hover': { bgcolor: 'rgba(0,229,255,0.08)' },
          '&.Mui-selected': { bgcolor: 'rgba(0,229,255,0.15)' },
        },
      },
    },
  };

  return (
    <Dialog open={open} onClose={handleClose} sx={dialogSx}>
      <DialogTitle sx={{ color: '#fff', fontWeight: 700, fontSize: 16, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Plus size={18} color="#00e5ff" />
        Tạo quy tắc mới
      </DialogTitle>

      <DialogContent sx={{ pt: '8px !important' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, fontSize: 12, bgcolor: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
            {error}
          </Alert>
        )}

        {/* Rule Type */}
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: 11, color: '#94a3b8', letterSpacing: '0.1em', mb: 1 }}>
            LOẠI QUY TẮC
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {[
              { type: 'PREREQUISITE' as RuleType, label: 'Ràng buộc', desc: 'Điều kiện tiên quyết', icon: Shield, color: '#f59e0b' },
              { type: 'CASCADE' as RuleType, label: 'Hoạt cảnh', desc: 'Liên hoàn tự động', icon: Zap, color: '#22c55e' },
            ].map(opt => (
              <Box
                key={opt.type}
                onClick={() => setRuleType(opt.type)}
                sx={{
                  flex: 1, p: 2, borderRadius: 2, cursor: 'pointer',
                  border: `1px solid ${ruleType === opt.type ? `${opt.color}60` : 'rgba(255,255,255,0.08)'}`,
                  bgcolor: ruleType === opt.type ? `${opt.color}10` : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s',
                  '&:hover': { border: `1px solid ${opt.color}40` },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <opt.icon size={14} color={ruleType === opt.type ? opt.color : '#64748b'} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: ruleType === opt.type ? opt.color : '#94a3b8' }}>
                    {opt.label}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 10, color: '#64748b' }}>{opt.desc}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2.5 }} />

        {/* Source Device */}
        <FormControl fullWidth sx={{ mb: 2, ...selectSx }}>
          <InputLabel>
            {ruleType === 'PREREQUISITE' ? 'Thiết bị cần bật (nguồn)' : 'Thiết bị nguồn (trigger)'}
          </InputLabel>
          <Select
            value={sourceDeviceId}
            onChange={(e) => setSourceDeviceId(e.target.value)}
            label={ruleType === 'PREREQUISITE' ? 'Thiết bị cần bật (nguồn)' : 'Thiết bị nguồn (trigger)'}
            MenuProps={menuSx}
          >
            {devices.map(d => (
              <MenuItem key={d.id} value={d.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={d.type} size="small" sx={{ height: 18, fontSize: 8, bgcolor: `${getTypeColor(d.type)}20`, color: getTypeColor(d.type) }} />
                  {d.name}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Target Device */}
        <FormControl fullWidth sx={{ mb: 2, ...selectSx }}>
          <InputLabel>
            {ruleType === 'PREREQUISITE' ? 'Thiết bị phải bật trước (đích)' : 'Thiết bị đích (target)'}
          </InputLabel>
          <Select
            value={targetDeviceId}
            onChange={(e) => setTargetDeviceId(e.target.value)}
            label={ruleType === 'PREREQUISITE' ? 'Thiết bị phải bật trước (đích)' : 'Thiết bị đích (target)'}
            MenuProps={menuSx}
          >
            {devices.filter(d => d.id !== sourceDeviceId).map(d => (
              <MenuItem key={d.id} value={d.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={d.type} size="small" sx={{ height: 18, fontSize: 8, bgcolor: `${getTypeColor(d.type)}20`, color: getTypeColor(d.type) }} />
                  {d.name}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* CASCADE-specific: triggerOn + targetAction */}
        {ruleType === 'CASCADE' && (
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <FormControl fullWidth sx={selectSx}>
              <InputLabel>Khi nguồn chuyển sang</InputLabel>
              <Select value={triggerOn} onChange={(e) => setTriggerOn(e.target.value)} label="Khi nguồn chuyển sang" MenuProps={menuSx}>
                <MenuItem value="ON">BẬT (ON)</MenuItem>
                <MenuItem value="OFF">TẮT (OFF)</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={selectSx}>
              <InputLabel>Thì đích sẽ</InputLabel>
              <Select value={targetAction} onChange={(e) => setTargetAction(e.target.value)} label="Thì đích sẽ" MenuProps={menuSx}>
                <MenuItem value="ON">BẬT (ON)</MenuItem>
                <MenuItem value="OFF">TẮT (OFF)</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Priority + Description */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="Ưu tiên"
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            sx={{ width: 120, ...selectSx }}
          />
          <TextField
            label="Mô tả (tùy chọn)"
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={selectSx}
          />
        </Box>

        {/* Preview */}
        {sourceDeviceId && targetDeviceId && (
          <Box
            sx={{
              p: 2, borderRadius: 2, mt: 1,
              bgcolor: 'rgba(0,229,255,0.05)',
              border: '1px solid rgba(0,229,255,0.15)',
            }}
          >
            <Typography sx={{ fontSize: 10, color: '#00e5ff', letterSpacing: '0.1em', mb: 1 }}>
              XEM TRƯỚC
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.6 }}>
              {ruleType === 'PREREQUISITE' ? (
                <>
                  Khi muốn bật <strong style={{ color: '#f59e0b' }}>{sourceName}</strong>,
                  hệ thống sẽ kiểm tra <strong style={{ color: '#f59e0b' }}>{targetName}</strong> đã bật chưa.
                  Nếu chưa → <span style={{ color: '#ef4444' }}>từ chối</span>.
                </>
              ) : (
                <>
                  Khi <strong style={{ color: '#22c55e' }}>{sourceName}</strong> chuyển sang{' '}
                  <strong style={{ color: '#22c55e' }}>{triggerOn}</strong> →
                  tự động <strong style={{ color: '#22c55e' }}>{targetAction === 'ON' ? 'bật' : 'tắt'}{' '}
                  {targetName}</strong>.
                </>
              )}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose} sx={{ color: '#94a3b8', fontSize: 12 }}>
          Hủy
        </Button>
        <Button
          onClick={handleCreate}
          disabled={creating || !sourceDeviceId || !targetDeviceId}
          variant="contained"
          sx={{
            fontSize: 12, fontWeight: 700,
            bgcolor: '#00e5ff', color: '#0f172a',
            '&:hover': { bgcolor: '#00b8d4' },
            '&:disabled': { bgcolor: 'rgba(0,229,255,0.2)', color: '#64748b' },
          }}
        >
          {creating ? <CircularProgress size={16} sx={{ color: '#0f172a' }} /> : 'Tạo quy tắc'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ─── Main Page ─── */
const DeviceRulesPage = () => {
  const theme = useTheme();
  const { currentBuilding } = useBuilding();
  const [rules, setRules] = useState<DeviceRule[]>([]);
  const [devices, setDevices] = useState<IDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'PREREQUISITE' | 'CASCADE'>('all');
  const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' | 'info' }>({
    open: false, msg: '', severity: 'info',
  });

  const buildingId = currentBuilding?.id;

  const loadData = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    try {
      const [rulesData, devicesResult] = await Promise.all([
        deviceRuleService.getRules(buildingId),
        deviceService.getDevices({ buildingId, take: 500 }),
      ]);
      setRules(Array.isArray(rulesData) ? rulesData : []);
      setDevices(devicesResult?.items || []);
    } catch (err) {
      console.error('Failed to load rules:', err);
      setToast({ open: true, msg: 'Không thể tải dữ liệu', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deviceRuleService.deleteRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
      setToast({ open: true, msg: 'Đã xóa quy tắc', severity: 'success' });
    } catch (err) {
      setToast({ open: true, msg: 'Xóa thất bại', severity: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreated = (newRule: DeviceRule) => {
    setRules(prev => [...prev, newRule]);
    setToast({ open: true, msg: 'Tạo quy tắc thành công!', severity: 'success' });
    // Reload to get full data with device names
    loadData();
  };

  const filteredRules = useMemo(() => {
    if (filterType === 'all') return rules;
    return rules.filter(r => r.ruleType === filterType);
  }, [rules, filterType]);

  const prereqCount = rules.filter(r => r.ruleType === 'PREREQUISITE').length;
  const cascadeCount = rules.filter(r => r.ruleType === 'CASCADE').length;

  if (!currentBuilding) {
    return (
      <Box sx={{ position: 'absolute', top: 90, left: 320, right: 20, bottom: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Link2 size={48} color="#1e293b" />
          <Typography sx={{ color: '#64748b', mt: 2, fontSize: 14 }}>
            Vui lòng chọn tòa nhà từ sidebar để quản lý quy tắc
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          top: 90,
          left: 320,
          right: 20,
          bottom: 90,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2,
            borderRadius: 3,
            bgcolor: 'rgba(2,6,23,0.9)',
            border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
            backdropFilter: 'blur(10px)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 40, height: 40, borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(0,229,255,0.2), rgba(0,180,219,0.1))',
                border: '1px solid rgba(0,229,255,0.3)',
              }}
            >
              <GitBranch size={20} color="#00e5ff" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                Quản lý Hoạt cảnh & Ràng buộc
              </Typography>
              <Typography sx={{ fontSize: 11, color: '#64748b' }}>
                {currentBuilding.name} — {rules.length} quy tắc
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Stats */}
            <Chip
              icon={<Shield size={12} />}
              label={`${prereqCount} ràng buộc`}
              size="small"
              sx={{
                height: 28, fontSize: 11, fontWeight: 600,
                bgcolor: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.2)',
                '& .MuiChip-icon': { color: '#f59e0b' },
              }}
            />
            <Chip
              icon={<Zap size={12} />}
              label={`${cascadeCount} hoạt cảnh`}
              size="small"
              sx={{
                height: 28, fontSize: 11, fontWeight: 600,
                bgcolor: 'rgba(34,197,94,0.1)', color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.2)',
                '& .MuiChip-icon': { color: '#22c55e' },
              }}
            />

            <Tooltip title="Tải lại">
              <IconButton onClick={loadData} sx={{ color: '#94a3b8', '&:hover': { color: '#00e5ff' } }}>
                <RefreshCw size={16} />
              </IconButton>
            </Tooltip>

            <Button
              startIcon={<Plus size={14} />}
              onClick={() => setDialogOpen(true)}
              sx={{
                ml: 1,
                fontSize: 12, fontWeight: 700,
                bgcolor: '#00e5ff', color: '#0f172a',
                borderRadius: 2, px: 2.5, height: 36,
                '&:hover': { bgcolor: '#00b8d4' },
              }}
            >
              Tạo quy tắc
            </Button>
          </Box>
        </Box>

        {/* Filter Tabs */}
        <Box sx={{ display: 'flex', gap: 1, px: 1 }}>
          {[
            { key: 'all' as const, label: 'Tất cả', count: rules.length },
            { key: 'PREREQUISITE' as const, label: 'Ràng buộc', count: prereqCount, color: '#f59e0b' },
            { key: 'CASCADE' as const, label: 'Hoạt cảnh', count: cascadeCount, color: '#22c55e' },
          ].map(tab => (
            <Chip
              key={tab.key}
              label={`${tab.label} (${tab.count})`}
              onClick={() => setFilterType(tab.key)}
              sx={{
                height: 30, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                bgcolor: filterType === tab.key
                  ? `${tab.color || '#00e5ff'}20`
                  : 'rgba(255,255,255,0.04)',
                color: filterType === tab.key
                  ? (tab.color || '#00e5ff')
                  : '#94a3b8',
                border: `1px solid ${filterType === tab.key ? `${tab.color || '#00e5ff'}40` : 'transparent'}`,
                '&:hover': { bgcolor: `${tab.color || '#00e5ff'}10` },
              }}
            />
          ))}
        </Box>

        {/* Rules List */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 1,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: 2 },
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <CircularProgress size={32} sx={{ color: '#00e5ff' }} />
            </Box>
          ) : filteredRules.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Link2 size={48} color="#1e293b" />
              <Typography sx={{ color: '#475569', mt: 2, fontSize: 14 }}>
                {filterType === 'all'
                  ? 'Chưa có quy tắc nào. Bấm "Tạo quy tắc" để bắt đầu.'
                  : `Không có quy tắc loại ${filterType === 'PREREQUISITE' ? 'ràng buộc' : 'hoạt cảnh'}.`
                }
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
                gap: 2,
                pb: 2,
              }}
            >
              {filteredRules.map(rule => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onDelete={handleDelete}
                  deleting={deletingId === rule.id}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* Create Dialog */}
      <CreateRuleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        devices={devices}
        buildingId={buildingId!}
        onCreated={handleCreated}
      />

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast(prev => ({ ...prev, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ fontSize: 12, fontWeight: 600 }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </>
  );
};

export default DeviceRulesPage;
