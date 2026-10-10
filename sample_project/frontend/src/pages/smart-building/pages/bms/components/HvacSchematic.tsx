import { Box, Typography, Chip } from '@mui/material';
import { useMemo } from 'react';

import type { IDevice } from '@/services/building-device/device.model';
import { getDeviceCustomIcon } from './DeviceIcons';

interface HvacSchematicProps {
  devices: IDevice[];
  selectedDeviceId?: string;
  onDeviceSelect?: (device: IDevice) => void;
  floorName?: string;
}

/* ─── HVAC Type Groups ─── */
const HVAC_GROUPS = {
  chillers: ['CHILLER'],
  coolingTowers: ['CHILLER_COOLING_TOWER'],
  coolingPumps: ['CHILLER_COOLING_PUMP'],
  coldPumps: ['CHILLER_COLD_PUMP'],
  chillerPipes: ['CHILLER_PIPE'],
  chillerValves: ['CHILLER_VALVE'],
  ahus: ['AHU'],
  ahuFilters: ['AHU_FILTER'],
  ahuValves: ['AHU_VALVE'],
  ahuSensors: ['AHU_SENSOR_TEMPERATURE'],
  paus: ['PAU'],
  pauFilters: ['PAU_FILTER'],
  pauValves: ['PAU_VALVE'],
  pauSensors: ['PAU_SENSOR_TEMPERATURE'],
  fcus: ['FCU'],
  vavs: ['VAV'],
  fans: ['FAN'],
  pumps: ['PUMP'],
  firePumps: ['FIRE_PUMP'],
  fireAlarms: ['FIRE_ALARM'],
  lights: ['LIGHT', 'DIM_LIGHT'],
  electric: ['ELECTRIC', 'ELECTRIC_METER', 'POWER_BREAKER'],
  meters: ['WATER_METER', 'BTU_METER', 'CO2_METER'],
};

type GroupKey = keyof typeof HVAC_GROUPS;

/* ─── Colors per group ─── */
const GROUP_COLORS: Record<string, string> = {
  chillers: '#22d3ee',
  coolingTowers: '#06b6d4',
  coolingPumps: '#0891b2',
  coldPumps: '#0e7490',
  chillerPipes: '#155e75',
  chillerValves: '#164e63',
  ahus: '#8b5cf6',
  ahuFilters: '#a78bfa',
  ahuValves: '#7c3aed',
  ahuSensors: '#6d28d9',
  paus: '#a78bfa',
  pauFilters: '#c4b5fd',
  pauValves: '#7c3aed',
  pauSensors: '#6d28d9',
  fcus: '#14b8a6',
  vavs: '#f97316',
  fans: '#3b82f6',
  pumps: '#06b6d4',
  firePumps: '#ef4444',
  fireAlarms: '#f59e0b',
  lights: '#eab308',
  electric: '#fbbf24',
  meters: '#f59e0b',
};

/* ─── Group Labels ─── */
const GROUP_LABELS: Record<string, string> = {
  chillers: 'Chiller',
  coolingTowers: 'Cooling Tower',
  coolingPumps: 'Cooling Pump',
  coldPumps: 'Cold Water Pump',
  chillerPipes: 'Chiller Pipe',
  chillerValves: 'Chiller Valve',
  ahus: 'AHU',
  ahuFilters: 'AHU Filter',
  ahuValves: 'AHU Valve',
  ahuSensors: 'AHU Sensor',
  paus: 'PAU',
  pauFilters: 'PAU Filter',
  pauValves: 'PAU Valve',
  pauSensors: 'PAU Sensor',
  fcus: 'FCU',
  vavs: 'VAV',
  fans: 'Fan',
  pumps: 'Pump',
  firePumps: 'Fire Pump',
  fireAlarms: 'Fire Alarm',
  lights: 'Lighting',
  electric: 'Electrical',
  meters: 'Meters',
};

const SVG_W = 1000;
const SVG_H = 600;

const HvacSchematic = ({
  devices,
  selectedDeviceId,
  onDeviceSelect,
  floorName,
}: HvacSchematicProps) => {
  const grouped = useMemo(() => {
    const result: Record<GroupKey, IDevice[]> = {} as any;
    for (const key of Object.keys(HVAC_GROUPS) as GroupKey[]) {
      result[key] = devices.filter((d) => HVAC_GROUPS[key].includes(d.type));
    }
    return result;
  }, [devices]);

  // Determine which system sections to show
  const hasCooling = grouped.chillers.length > 0 || grouped.coolingTowers.length > 0 || grouped.coolingPumps.length > 0;
  const hasAir = grouped.ahus.length > 0 || grouped.paus.length > 0;
  const hasTerminal = grouped.fcus.length > 0 || grouped.vavs.length > 0;
  const hasFan = grouped.fans.length > 0;
  const hasPump = grouped.pumps.length > 0;
  const hasLighting = grouped.lights.length > 0;
  const hasFire = grouped.firePumps.length > 0 || grouped.fireAlarms.length > 0;
  const hasElectric = grouped.electric.length > 0;

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #0B1220 0%, #0F172A 100%)',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid rgba(0,200,255,0.1)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5, py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#8b5cf6', boxShadow: '0 0 8px #8b5cf6' }} />
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
            HVAC Schematic {floorName ? `— ${floorName}` : ''}
          </Typography>
        </Box>
        <Typography sx={{ color: '#64748b', fontSize: 11 }}>
          {devices.length} thiết bị • Click để điều khiển
        </Typography>
      </Box>

      {/* SVG Schematic */}
      <Box sx={{ flex: 1, position: 'relative', p: 1 }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Background grid */}
          <defs>
            <pattern id="schematicGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
            </pattern>
            {/* Animated flow dots */}
            <marker id="flowDot" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4">
              <circle cx="3" cy="3" r="3" fill="#22d3ee" opacity="0.8" />
            </marker>
          </defs>
          <rect width={SVG_W} height={SVG_H} fill="url(#schematicGrid)" />

          {/* ═══ COOLING SYSTEM (Left) ═══ */}
          {hasCooling && (
            <g>
              <SectionLabel x={40} y={35} label="COOLING PLANT" />

              {/* Cooling Tower */}
              {grouped.coolingTowers.map((d, i) => (
                <SchematicDevice
                  key={d.id} device={d}
                  x={80 + i * 140} y={70}
                  color={GROUP_COLORS.coolingTowers}
                  isSelected={selectedDeviceId === d.id}
                  onClick={() => onDeviceSelect?.(d)}
                  icon="🗼"
                />
              ))}

              {/* Cooling Pump */}
              {grouped.coolingPumps.map((d, i) => (
                <SchematicDevice
                  key={d.id} device={d}
                  x={80 + i * 140} y={180}
                  color={GROUP_COLORS.coolingPumps}
                  isSelected={selectedDeviceId === d.id}
                  onClick={() => onDeviceSelect?.(d)}
                  icon="💧"
                />
              ))}

              {/* Chiller */}
              {grouped.chillers.map((d, i) => (
                <SchematicDevice
                  key={d.id} device={d}
                  x={80 + i * 140} y={290}
                  color={GROUP_COLORS.chillers}
                  isSelected={selectedDeviceId === d.id}
                  onClick={() => onDeviceSelect?.(d)}
                  icon="❄️"
                  large
                />
              ))}

              {/* Cold Pump */}
              {grouped.coldPumps.map((d, i) => (
                <SchematicDevice
                  key={d.id} device={d}
                  x={80 + i * 140} y={410}
                  color={GROUP_COLORS.coldPumps}
                  isSelected={selectedDeviceId === d.id}
                  onClick={() => onDeviceSelect?.(d)}
                  icon="💧"
                />
              ))}

              {/* Connection pipes - animated */}
              {grouped.coolingTowers.length > 0 && grouped.coolingPumps.length > 0 && (
                <FlowPipe x1={120} y1={115} x2={120} y2={170} color="#06b6d4" />
              )}
              {grouped.coolingPumps.length > 0 && grouped.chillers.length > 0 && (
                <FlowPipe x1={120} y1={225} x2={120} y2={270} color="#0891b2" />
              )}
              {grouped.chillers.length > 0 && grouped.coldPumps.length > 0 && (
                <FlowPipe x1={120} y1={350} x2={120} y2={400} color="#22d3ee" />
              )}
            </g>
          )}

          {/* ═══ AIR HANDLING (Center) ═══ */}
          {hasAir && (
            <g>
              <SectionLabel x={380} y={35} label="AIR HANDLING" />

              {/* AHU */}
              {grouped.ahus.map((d, i) => (
                <SchematicDevice
                  key={d.id} device={d}
                  x={400 + i * 140} y={80}
                  color={GROUP_COLORS.ahus}
                  isSelected={selectedDeviceId === d.id}
                  onClick={() => onDeviceSelect?.(d)}
                  icon="🌀"
                  large
                />
              ))}

              {/* PAU */}
              {grouped.paus.map((d, i) => (
                <SchematicDevice
                  key={d.id} device={d}
                  x={400 + i * 140} y={200}
                  color={GROUP_COLORS.paus}
                  isSelected={selectedDeviceId === d.id}
                  onClick={() => onDeviceSelect?.(d)}
                  icon="🌬️"
                  large
                />
              ))}

              {/* Connection from Chiller to AHU */}
              {grouped.chillers.length > 0 && grouped.ahus.length > 0 && (
                <FlowPipe x1={240} y1={310} x2={390} y2={120} color="#8b5cf6" />
              )}

              {/* AHU Valves + Filters */}
              {grouped.ahuValves.map((d, i) => (
                <SchematicDevice key={d.id} device={d} x={560 + i * 100} y={80} color={GROUP_COLORS.ahuValves} isSelected={selectedDeviceId === d.id} onClick={() => onDeviceSelect?.(d)} icon="🔧" small />
              ))}
              {grouped.ahuFilters.map((d, i) => (
                <SchematicDevice key={d.id} device={d} x={560 + i * 100} y={140} color={GROUP_COLORS.ahuFilters} isSelected={selectedDeviceId === d.id} onClick={() => onDeviceSelect?.(d)} icon="🔲" small />
              ))}
            </g>
          )}

          {/* ═══ TERMINAL UNITS (Right) ═══ */}
          {hasTerminal && (
            <g>
              <SectionLabel x={700} y={35} label="TERMINAL UNITS" />

              {/* FCU */}
              {grouped.fcus.map((d, i) => (
                <SchematicDevice
                  key={d.id} device={d}
                  x={720 + (i % 3) * 90} y={70 + Math.floor(i / 3) * 100}
                  color={GROUP_COLORS.fcus}
                  isSelected={selectedDeviceId === d.id}
                  onClick={() => onDeviceSelect?.(d)}
                  icon="🌡️"
                />
              ))}

              {/* VAV */}
              {grouped.vavs.map((d, i) => (
                <SchematicDevice
                  key={d.id} device={d}
                  x={720 + (i % 3) * 90} y={280 + Math.floor(i / 3) * 100}
                  color={GROUP_COLORS.vavs}
                  isSelected={selectedDeviceId === d.id}
                  onClick={() => onDeviceSelect?.(d)}
                  icon="📊"
                />
              ))}

              {/* AHU → FCU pipe */}
              {grouped.ahus.length > 0 && grouped.fcus.length > 0 && (
                <FlowPipe x1={540} y1={120} x2={710} y2={100} color="#14b8a6" />
              )}
            </g>
          )}

          {/* ═══ OTHER SYSTEMS (Bottom) ═══ */}
          <g>
            {/* Fans */}
            {hasFan && (
              <g>
                <SectionLabel x={40} y={490} label="VENTILATION" />
                {grouped.fans.map((d, i) => (
                  <SchematicDevice key={d.id} device={d} x={60 + i * 100} y={520} color={GROUP_COLORS.fans} isSelected={selectedDeviceId === d.id} onClick={() => onDeviceSelect?.(d)} icon="💨" />
                ))}
              </g>
            )}

            {/* Pumps */}
            {hasPump && (
              <g>
                <SectionLabel x={380} y={490} label="PUMPS" />
                {grouped.pumps.map((d, i) => (
                  <SchematicDevice key={d.id} device={d} x={400 + i * 100} y={520} color={GROUP_COLORS.pumps} isSelected={selectedDeviceId === d.id} onClick={() => onDeviceSelect?.(d)} icon="⚙️" />
                ))}
              </g>
            )}

            {/* Fire System */}
            {hasFire && (
              <g>
                <SectionLabel x={700} y={390} label="FIRE SYSTEM" />
                {grouped.firePumps.map((d, i) => (
                  <SchematicDevice key={d.id} device={d} x={720 + i * 100} y={420} color={GROUP_COLORS.firePumps} isSelected={selectedDeviceId === d.id} onClick={() => onDeviceSelect?.(d)} icon="🔥" />
                ))}
                {grouped.fireAlarms.map((d, i) => (
                  <SchematicDevice key={d.id} device={d} x={720 + i * 100} y={510} color={GROUP_COLORS.fireAlarms} isSelected={selectedDeviceId === d.id} onClick={() => onDeviceSelect?.(d)} icon="🚨" small />
                ))}
              </g>
            )}

            {/* Lighting */}
            {hasLighting && (
              <g>
                <SectionLabel x={380} y={390} label="LIGHTING" />
                {grouped.lights.map((d, i) => (
                  <SchematicDevice key={d.id} device={d} x={400 + i * 80} y={420} color={GROUP_COLORS.lights} isSelected={selectedDeviceId === d.id} onClick={() => onDeviceSelect?.(d)} icon="💡" small />
                ))}
              </g>
            )}

            {/* Electrical */}
            {hasElectric && (
              <g>
                <SectionLabel x={40} y={390} label="ELECTRICAL" />
                {grouped.electric.map((d, i) => (
                  <SchematicDevice key={d.id} device={d} x={60 + i * 100} y={420} color={GROUP_COLORS.electric} isSelected={selectedDeviceId === d.id} onClick={() => onDeviceSelect?.(d)} icon="⚡" />
                ))}
              </g>
            )}
          </g>
        </svg>
      </Box>

      {/* Legend */}
      <Box
        sx={{
          px: 2, py: 1,
          display: 'flex', gap: 1.5, flexWrap: 'wrap',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          bgcolor: 'rgba(2,6,23,0.5)',
          alignItems: 'center',
        }}
      >
        {(Object.keys(HVAC_GROUPS) as GroupKey[])
          .filter((key) => grouped[key].length > 0)
          .map((key) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: 1, bgcolor: GROUP_COLORS[key] }} />
              <Typography sx={{ color: '#94a3b8', fontSize: 9 }}>
                {GROUP_LABELS[key]} ({grouped[key].length})
              </Typography>
            </Box>
          ))}
      </Box>
    </Box>
  );
};

/* ═══ Sub-components ═══ */

const SectionLabel = ({ x, y, label }: { x: number; y: number; label: string }) => (
  <text x={x} y={y} fill="rgba(255,255,255,0.25)" fontSize={11} fontWeight={700} fontFamily="Inter, sans-serif" letterSpacing="0.15em">
    {label}
  </text>
);

interface SchematicDeviceProps {
  device: IDevice;
  x: number;
  y: number;
  color: string;
  isSelected: boolean;
  onClick: () => void;
  icon: string;
  large?: boolean;
  small?: boolean;
}

const SchematicDevice = ({
  device, x, y, color, isSelected, onClick, icon, large, small,
}: SchematicDeviceProps) => {
  const isOnline = device.isOnline !== false;
  const attrs = device.attributes as Record<string, any> | null;
  const isRunning = attrs?.running === 1 || attrs?.running === true || attrs?.status === true || attrs?.state === 1;
  const size = large ? 50 : small ? 28 : 38;
  const statusColor = isOnline ? (isRunning ? '#22c55e' : '#f59e0b') : '#ef4444';

  // Get primary value to display
  let displayValue = '';
  if (attrs) {
    if (attrs.temperature != null) displayValue = `${Number(attrs.temperature).toFixed(1)}°C`;
    else if (attrs.setpoint != null) displayValue = `SP: ${attrs.setpoint}°C`;
    else if (attrs.speed != null) displayValue = `Speed: ${attrs.speed}`;
    else if (attrs.fanSpeed != null) displayValue = `Fan: ${attrs.fanSpeed}`;
    else if (attrs.valvePosition != null) displayValue = `Valve: ${attrs.valvePosition}%`;
    else if (attrs.pressure != null) displayValue = `${attrs.pressure} bar`;
    else if (attrs.power != null) displayValue = `${attrs.power} kW`;
    else if (attrs.brightness != null) displayValue = `${attrs.brightness}%`;
  }

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: 'pointer' }}
      onClick={(e: any) => { e.stopPropagation(); onClick(); }}
    >
      {/* Selection glow */}
      {isSelected && (
        <rect
          x={-size / 2 - 6} y={-size / 2 - 6}
          width={size + 12} height={size + 12}
          rx={12} fill="none"
          stroke="#00e5ff" strokeWidth={2} opacity={0.6}
        >
          <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Device box */}
      <rect
        x={-size / 2} y={-size / 2}
        width={size} height={size}
        rx={large ? 12 : 8}
        fill={isSelected ? `${color}30` : 'rgba(15,23,42,0.9)'}
        stroke={isSelected ? '#00e5ff' : color}
        strokeWidth={isSelected ? 2 : 1}
      />

      {/* Status indicator */}
      <circle
        cx={size / 2 - 4} cy={-size / 2 + 4}
        r={4} fill={statusColor}
        stroke="#0f172a" strokeWidth={1.5}
      >
        {isOnline && isRunning && (
          <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
        )}
      </circle>

      {/* Custom Icon */}
      {(() => {
        const Icon = getDeviceCustomIcon(device.type);
        const iconSize = large ? 32 : small ? 16 : 24;
        const iconY = displayValue ? -4 - iconSize/2 : -iconSize/2;
        return <Icon x={-iconSize/2} y={iconY} width={iconSize} height={iconSize} color={color} />;
      })()}

      {/* Value display */}
      {displayValue && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          y={size / 2 - 8}
          fill={color}
          fontSize={8}
          fontWeight={600}
          fontFamily="Inter, sans-serif"
        >
          {displayValue}
        </text>
      )}

      {/* Name label below */}
      <text
        y={size / 2 + 14}
        textAnchor="middle"
        fill={isSelected ? '#e2e8f0' : '#94a3b8'}
        fontSize={9}
        fontFamily="Inter, sans-serif"
        fontWeight={isSelected ? 600 : 400}
      >
        {device.name.length > 14 ? device.name.slice(0, 14) + '…' : device.name}
      </text>
    </g>
  );
};

/* ─── Animated flow pipe ─── */
const FlowPipe = ({
  x1, y1, x2, y2, color,
}: {
  x1: number; y1: number; x2: number; y2: number; color: string;
}) => (
  <g>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} opacity={0.3} />
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} strokeDasharray="6 8" opacity={0.7}>
      <animate attributeName="stroke-dashoffset" values="0;-28" dur="2s" repeatCount="indefinite" />
    </line>
  </g>
);

export default HvacSchematic;
