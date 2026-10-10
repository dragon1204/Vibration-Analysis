import React from 'react';

export const ChillerIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <rect x="4" y="16" width="56" height="32" rx="4" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <circle cx="20" cy="32" r="10" stroke={color} strokeWidth="2" />
    <circle cx="44" cy="32" r="10" stroke={color} strokeWidth="2" />
    <circle cx="20" cy="32" r="4" fill={color} />
    <circle cx="44" cy="32" r="4" fill={color} />
    <path d="M4 24 H10 M54 24 H60 M4 40 H10 M54 40 H60" stroke={color} strokeWidth="3" />
  </svg>
);

export const PumpIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <rect x="12" y="24" width="24" height="16" rx="2" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <circle cx="44" cy="32" r="12" stroke={color} strokeWidth="3" fill={`${color}40`} />
    <path d="M44 20 V8 M56 32 H64" stroke={color} strokeWidth="4" />
    <circle cx="44" cy="32" r="4" fill={color} />
  </svg>
);

export const CoolingTowerIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <path d="M16 60 L24 16 H40 L48 60 Z" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <ellipse cx="32" cy="16" rx="16" ry="6" stroke={color} strokeWidth="2" fill={`${color}40`} />
    <path d="M32 16 L24 16 M32 16 L36 12 M32 16 L36 20" stroke={color} strokeWidth="2" />
    <path d="M18 48 H46 M17 54 H47 M19 42 H45" stroke={color} strokeWidth="2" opacity="0.6" />
  </svg>
);

export const AhuIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <rect x="4" y="16" width="56" height="32" rx="2" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <path d="M20 16 V48 M40 16 V48" stroke={color} strokeWidth="2" />
    <path d="M8 20 L16 44 M12 20 L20 44" stroke={color} strokeWidth="1.5" opacity="0.6" />
    <path d="M24 24 L36 28 L24 36 L36 40" stroke={color} strokeWidth="2" />
    <circle cx="50" cy="32" r="8" stroke={color} strokeWidth="2" />
    <path d="M50 24 V40 M42 32 H58" stroke={color} strokeWidth="2" />
  </svg>
);

export const FcuIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <rect x="12" y="20" width="40" height="24" rx="2" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <circle cx="24" cy="32" r="6" stroke={color} strokeWidth="2" />
    <path d="M36 24 H48 M36 32 H48 M36 40 H48" stroke={color} strokeWidth="2" opacity="0.7" />
  </svg>
);

export const FanIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="24" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <circle cx="32" cy="32" r="6" fill={color} />
    <path d="M32 26 C40 16, 50 24, 38 32 C48 40, 40 50, 32 38 C24 48, 14 40, 26 32 C16 24, 24 14, 32 26 Z" fill={color} opacity="0.8" />
  </svg>
);

export const ValveIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <path d="M16 16 L48 48 M48 16 L16 48" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <path d="M16 16 L48 16 L16 48 L48 48 Z" stroke={color} strokeWidth="2" fill={`${color}10`} />
    <circle cx="32" cy="32" r="6" fill={color} />
    <rect x="28" y="4" width="8" height="12" stroke={color} strokeWidth="2" fill={color} />
  </svg>
);

export const FilterIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <rect x="16" y="8" width="32" height="48" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <path d="M16 16 H48 M16 24 H48 M16 32 H48 M16 40 H48 M16 48 H48" stroke={color} strokeWidth="1.5" opacity="0.6" />
  </svg>
);

export const FireAlarmIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <path d="M32 8 L56 50 H8 Z" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <circle cx="32" cy="42" r="3" fill={color} />
    <path d="M32 24 V36" stroke={color} strokeWidth="4" strokeLinecap="round" />
  </svg>
);

export const CameraIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <rect x="12" y="24" width="32" height="20" rx="4" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <path d="M44 28 L56 20 V44 L44 36" stroke={color} strokeWidth="3" fill={`${color}20`} strokeLinejoin="round" />
    <circle cx="28" cy="34" r="4" fill={color} />
  </svg>
);

export const LightIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="24" r="16" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <path d="M24 44 H40 M26 50 H38 M30 56 H34" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <path d="M32 24 V32" stroke={color} strokeWidth="2" />
  </svg>
);

export const ElectricIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <rect x="16" y="8" width="32" height="48" rx="2" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <path d="M36 20 L24 36 H38 L30 50" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const MeterIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <rect x="12" y="16" width="40" height="32" rx="4" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <rect x="20" y="24" width="24" height="12" stroke={color} strokeWidth="2" fill={`${color}40`} />
    <path d="M24 30 H26 M30 30 H32 M36 30 H38" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const PipeIcon = ({ x, y, width, height, color }: any) => (
  <svg x={x} y={y} width={width} height={height} viewBox="0 0 64 64" fill="none">
    <rect x="16" y="28" width="32" height="8" stroke={color} strokeWidth="3" fill={`${color}20`} />
    <path d="M8 24 V40 M56 24 V40" stroke={color} strokeWidth="4" strokeLinecap="round" />
  </svg>
);

export const getDeviceCustomIcon = (type: string) => {
  if (type.includes('CHILLER_COOLING_TOWER')) return CoolingTowerIcon;
  if (type.includes('CHILLER_VALVE')) return ValveIcon;
  if (type.includes('CHILLER_PIPE')) return PipeIcon;
  if (type.includes('CHILLER')) return ChillerIcon;
  if (type.includes('FIRE_PUMP')) return PumpIcon;
  if (type.includes('PUMP')) return PumpIcon;
  if (type.includes('AHU_FILTER') || type.includes('PAU_FILTER')) return FilterIcon;
  if (type.includes('AHU_VALVE') || type.includes('PAU_VALVE')) return ValveIcon;
  if (type.includes('AHU') || type.includes('PAU')) return AhuIcon;
  if (type.includes('FCU') || type.includes('VAV') || type.includes('COOLING')) return FcuIcon;
  if (type.includes('FAN')) return FanIcon;
  if (type.includes('FIRE_ALARM')) return FireAlarmIcon;
  if (type.includes('CAMERA')) return CameraIcon;
  if (type.includes('LIGHT')) return LightIcon;
  if (type.includes('METER') || type.includes('SENSOR')) return MeterIcon;
  if (type.includes('ELECTRIC') || type.includes('POWER')) return ElectricIcon;
  return FcuIcon; // Fallback
};
