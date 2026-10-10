/**
 * DeviceAttributeControl — Editable control for HVAC device attributes.
 * Renders appropriate UI control based on attribute key and value type:
 *   - Boolean → Switch (on/off)
 *   - State/running → Switch (0/1)
 *   - FanSpeed → Slider (0-5) or increment/decrement
 *   - Setpoint/Temperature → Number input with +/- buttons
 *   - ValvePosition → Slider (0-100%)
 *   - Other numbers → Inline number input
 *   - Read-only → Static text with sensor badge (e.g. RoomTemp, fault)
 */
import { Box, Chip, Slider, Switch, Typography, IconButton } from '@mui/material';
import { Eye, Minus, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';

/**
 * Map of device type → set of controllable (writable) attribute keys.
 * Any key NOT listed here for a given device type is treated as read-only.
 * If a device type is not listed, all keys are assumed controllable (legacy behavior).
 */
const CONTROLLABLE_KEYS: Record<string, Set<string>> = {
  FAN:                    new Set(['state', 'fan_speed', 'mode']),
  LIGHT:                  new Set(['state']),
  DIM_LIGHT:              new Set(['state', 'brightness']),
  PUMP:                   new Set(['state', 'mode']),
  FIRE_PUMP:              new Set(['state', 'mode']),
  CHILLER:                new Set(['state', 'mode']),
  CHILLER_COLD_PUMP:      new Set(['state', 'mode', 'speed']),
  CHILLER_COOLING_PUMP:   new Set(['state', 'mode', 'speed']),
  CHILLER_COOLING_TOWER:  new Set(['state', 'mode']),
  CHILLER_VALVE:          new Set(['state']),
  CHILLER_PIPE:           new Set(['state']),
  AHU:                    new Set(['state', 'mode', 'fanSpeed']),
  AHU_VALVE:              new Set(['state']),
  AHU_FILTER:             new Set([]),   // read-only only
  AHU_SENSOR_TEMPERATURE: new Set([]),   // read-only only
  PAU:                    new Set(['state', 'mode', 'fanSpeed']),
  PAU_VALVE:              new Set(['state']),
  PAU_FILTER:             new Set([]),   // read-only only
  PAU_SENSOR_TEMPERATURE: new Set([]),   // read-only only
  FCU:                    new Set(['state', 'speed', 'command']),
  VAV:                    new Set(['state', 'openingAngle', 'command']),
};

/** Determine if an attribute key is controllable for a specific device type */
const isControllable = (key: string, deviceType?: string): boolean => {
  if (!deviceType) return true; // fallback: assume controllable
  const allowed = CONTROLLABLE_KEYS[deviceType];
  if (!allowed) return true; // device type not mapped: assume controllable
  return allowed.has(key);
};

/** Config for slider-based controls */
interface SliderConfig {
  min: number;
  max: number;
  step: number;
  unit?: string;
}

const SLIDER_CONFIGS: Record<string, SliderConfig> = {
  fanspeed:        { min: 0, max: 5, step: 1 },
  fan_speed:       { min: 0, max: 100, step: 1 },
  speed:           { min: 0, max: 100, step: 1 },
  valveposition:   { min: 0, max: 100, step: 5, unit: '%' },
  valve:           { min: 0, max: 100, step: 5, unit: '%' },
  openingangle:    { min: 0, max: 100, step: 5, unit: '%' },
  setpoint:        { min: 16, max: 30, step: 0.5, unit: '°C' },
  settemp:         { min: 16, max: 30, step: 0.5, unit: '°C' },
  dimming:         { min: 0, max: 100, step: 5, unit: '%' },
  brightness:      { min: 0, max: 100, step: 5, unit: '%' },
};

const getSliderConfig = (key: string): SliderConfig | null => {
  return SLIDER_CONFIGS[key.toLowerCase()] || null;
};

/** Is this key a state/running/on-off toggle? */
const isToggleKey = (key: string): boolean => {
  const k = key.toLowerCase();
  return ['state', 'running', 'status', 'onoff', 'on_off', 'enable', 'enabled', 'active'].includes(k);
};

/** Unit labels for read-only sensor values */
const SENSOR_UNITS: Record<string, string> = {
  temp: '°C',
  temperature: '°C',
  air_temperature: '°C',
  air_pressure: 'Pa',
  pressure: 'bar',
  humidity: '%',
  co2: 'ppm',
  flowrate: 'm³/h',
  flowRate: 'm³/h',
  power: 'kW',
  energy: 'kWh',
  voltage: 'V',
  current: 'A',
  frequency: 'Hz',
};

interface DeviceAttributeControlProps {
  attrKey: string;
  value: any;
  disabled?: boolean;
  deviceType?: string;
  onCommand: (key: string, value: any) => void;
}

const DeviceAttributeControl = ({
  attrKey,
  value,
  disabled = false,
  deviceType,
  onCommand,
}: DeviceAttributeControlProps) => {
  const controllable = isControllable(attrKey, deviceType);
  const label = attrKey.replace(/_/g, ' ');

  /* ─── Read-only: boolean (e.g. fault) ─── */
  if (!controllable && typeof value === 'boolean') {
    return (
      <ControlRow label={label} readOnly>
        <Chip
          label={value ? 'YES' : 'NO'}
          size="small"
          sx={{
            height: 22,
            fontSize: 10,
            fontWeight: 700,
            bgcolor: value ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
            color: value ? '#ef4444' : '#22c55e',
            border: `1px solid ${value ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          }}
        />
      </ControlRow>
    );
  }

  /* ─── Read-only: numeric toggle (e.g. fault = 0/1) ─── */
  if (!controllable && isToggleKey(attrKey) && typeof value === 'number') {
    const isOn = value > 0;
    return (
      <ControlRow label={label} readOnly>
        <Chip
          label={isOn ? 'ON' : 'OFF'}
          size="small"
          sx={{
            height: 22,
            fontSize: 10,
            fontWeight: 700,
            bgcolor: isOn ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: isOn ? '#22c55e' : '#ef4444',
            border: `1px solid ${isOn ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}
        />
      </ControlRow>
    );
  }

  /* ─── Read-only: numeric sensor ─── */
  if (!controllable && typeof value === 'number') {
    const unit = SENSOR_UNITS[attrKey] || '';
    return (
      <ControlRow label={label} readOnly>
        <Typography sx={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
          {value % 1 !== 0 ? value.toFixed(1) : value}
          {unit && (
            <Typography component="span" sx={{ color: '#64748b', fontSize: 10, ml: 0.5 }}>
              {unit}
            </Typography>
          )}
        </Typography>
      </ControlRow>
    );
  }

  /* ─── Read-only: other types ─── */
  if (!controllable) {
    return (
      <ControlRow label={label} readOnly>
        <Typography sx={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
          {String(value)}
        </Typography>
      </ControlRow>
    );
  }

  /* ═══ Controllable attributes below ═══ */

  /* ─── Boolean toggle ─── */
  if (typeof value === 'boolean') {
    return (
      <ControlRow label={label}>
        <Switch
          size="small"
          checked={value}
          disabled={disabled}
          onChange={(_, checked) => onCommand(attrKey, checked)}
          sx={{
            '& .MuiSwitch-switchBase.Mui-checked': { color: '#00e5ff' },
            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#00e5ff' },
          }}
        />
      </ControlRow>
    );
  }

  /* ─── State / Running as numeric toggle (0/1) ─── */
  if (isToggleKey(attrKey) && typeof value === 'number') {
    const isOn = value > 0;
    return (
      <ControlRow label={label}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ color: isOn ? '#22c55e' : '#ef4444', fontSize: 11, fontWeight: 600 }}>
            {isOn ? 'ON' : 'OFF'}
          </Typography>
          <Switch
            size="small"
            checked={isOn}
            disabled={disabled}
            onChange={(_, checked) => onCommand(attrKey, checked)}
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: '#00e5ff' },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#00e5ff' },
            }}
          />
        </Box>
      </ControlRow>
    );
  }

  /* ─── Slider control ─── */
  const sliderCfg = getSliderConfig(attrKey);
  if (sliderCfg && typeof value === 'number') {
    return (
      <ControlRow label={label}>
        <SliderControl
          value={value}
          config={sliderCfg}
          disabled={disabled}
          onChange={(v) => onCommand(attrKey, v)}
        />
      </ControlRow>
    );
  }

  /* ─── Other numeric — editable with +/- ─── */
  if (typeof value === 'number') {
    return (
      <ControlRow label={label}>
        <NumberInput
          value={value}
          step={value % 1 !== 0 ? 0.5 : 1}
          disabled={disabled}
          onChange={(v) => onCommand(attrKey, v)}
        />
      </ControlRow>
    );
  }

  /* ─── Fallback: string value ─── */
  return (
    <ControlRow label={label}>
      <Typography sx={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
        {String(value)}
      </Typography>
    </ControlRow>
  );
};

/* ═══ Sub-components ═══ */

const ControlRow = ({
  label,
  readOnly,
  children,
}: {
  label: string;
  readOnly?: boolean;
  children: React.ReactNode;
}) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.25, minHeight: 44 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, maxWidth: '45%' }}>
      <Typography sx={{ color: readOnly ? '#64748b' : '#94a3b8', fontSize: 12, textTransform: 'capitalize' }}>
        {label}
      </Typography>
      {readOnly && (
        <Eye size={11} color="#475569" />
      )}
    </Box>
    {children}
  </Box>
);

/* ─── Slider with value display ─── */
const SliderControl = ({
  value: initialValue,
  config,
  disabled,
  onChange,
}: {
  value: number;
  config: SliderConfig;
  disabled: boolean;
  onChange: (v: number) => void;
}) => {
  const [localValue, setLocalValue] = useState(initialValue);

  useEffect(() => {
    setLocalValue(initialValue);
  }, [initialValue]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, maxWidth: '55%' }}>
      <Slider
        size="small"
        value={localValue}
        min={config.min}
        max={config.max}
        step={config.step}
        disabled={disabled}
        onChange={(_, v) => setLocalValue(v as number)}
        onChangeCommitted={(_, v) => onChange(v as number)}
        sx={{
          color: '#00e5ff',
          height: 4,
          '& .MuiSlider-thumb': {
            width: 14,
            height: 14,
            bgcolor: '#00e5ff',
            '&:hover': { boxShadow: '0 0 8px rgba(0,229,255,0.4)' },
          },
          '& .MuiSlider-track': { bgcolor: '#00e5ff' },
          '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.1)' },
          '& .Mui-disabled': { color: '#475569' },
        }}
      />
      <Typography
        sx={{
          color: '#e2e8f0',
          fontSize: 12,
          fontWeight: 700,
          minWidth: 36,
          textAlign: 'right',
        }}
      >
        {localValue}{config.unit || ''}
      </Typography>
    </Box>
  );
};

/* ─── Number input with +/- buttons ─── */
const NumberInput = ({
  value: initialValue,
  step = 1,
  disabled,
  onChange,
}: {
  value: number;
  step?: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) => {
  const [localValue, setLocalValue] = useState(initialValue);

  useEffect(() => {
    setLocalValue(initialValue);
  }, [initialValue]);

  const handleChange = (delta: number) => {
    const newVal = Math.round((localValue + delta) * 100) / 100;
    setLocalValue(newVal);
    onChange(newVal);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <IconButton
        size="small"
        disabled={disabled}
        onClick={() => handleChange(-step)}
        sx={{
          borderRadius: 0,
          color: '#00e5ff',
          px: 1,
          py: 0.5,
          '&:hover': { bgcolor: 'rgba(0,229,255,0.1)' },
        }}
      >
        <Minus size={14} />
      </IconButton>
      <Typography
        sx={{
          color: '#e2e8f0',
          fontSize: 13,
          fontWeight: 700,
          px: 1.5,
          minWidth: 36,
          textAlign: 'center',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {localValue % 1 !== 0 ? localValue.toFixed(1) : localValue}
      </Typography>
      <IconButton
        size="small"
        disabled={disabled}
        onClick={() => handleChange(step)}
        sx={{
          borderRadius: 0,
          color: '#00e5ff',
          px: 1,
          py: 0.5,
          '&:hover': { bgcolor: 'rgba(0,229,255,0.1)' },
        }}
      >
        <Plus size={14} />
      </IconButton>
    </Box>
  );
};

export default DeviceAttributeControl;
