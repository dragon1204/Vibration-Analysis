import { Box } from '@mui/material';

interface ViewModeToggleProps {
  mode: '2d' | '3d' | 'schematic';
  onChange: (mode: '2d' | '3d' | 'schematic') => void;
}

const VIEW_MODES: { key: '2d' | '3d' | 'schematic'; label: string }[] = [
  { key: '2d', label: '2D Plan' },
  { key: '3d', label: '3D View' },
  { key: 'schematic', label: 'Schematic' },
];

const ViewModeToggle = ({ mode, onChange }: ViewModeToggleProps) => {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(0,200,255,0.2)',
        backdropFilter: 'blur(12px)',
        background: 'rgba(2,6,23,0.8)',
      }}
    >
      {VIEW_MODES.map((m) => (
        <Box
          key={m.key}
          onClick={() => onChange(m.key)}
          sx={{
            px: 2,
            py: 1,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: mode === m.key ? '#020617' : '#94a3b8',
            bgcolor: mode === m.key ? '#00e5ff' : 'transparent',
            transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            whiteSpace: 'nowrap',
            '&:hover': {
              bgcolor: mode === m.key ? '#00e5ff' : 'rgba(0,200,255,0.08)',
              color: mode === m.key ? '#020617' : '#e2e8f0',
            },
          }}
        >
          <span>{m.label}</span>
        </Box>
      ))}
    </Box>
  );
};

export default ViewModeToggle;
