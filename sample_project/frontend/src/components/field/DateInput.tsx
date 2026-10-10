import { Box } from '@mui/material';
import { PatternFormat } from 'react-number-format';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';

const toDDMMYYYY = (val?: string | Date | null) => {
  if (!val) return '';
  const str = val instanceof Date ? val.toISOString() : String(val);
  const datePart = str.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
};

const toYYYYMMDD = (val?: string | Date | null) => {
  if (!val) return '';
  const str = val instanceof Date ? val.toISOString() : String(val);
  return str.split('T')[0];
};

const toISO = (valStr: string) => {
  if (!valStr) return undefined;
  // If native date picker string (YYYY-MM-DD)
  if (valStr.includes('-')) {
    return new Date(`${valStr}T00:00:00Z`).toISOString();
  }
  // If pattern format string (DD/MM/YYYY)
  const parts = valStr.split('/');
  if (parts.length !== 3) return undefined;
  const [d, m, y] = parts;
  
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year = parseInt(y, 10);
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return undefined;

  return new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
};

export const DateInput = ({
  value,
  onChange,
  readOnly,
  style,
}: {
  value?: string | Date | null;
  onChange: (val?: string) => void;
  readOnly?: boolean;
  style?: React.CSSProperties;
}) => {
  return (
    <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <PatternFormat
        format="##/##/####"
        mask="_"
        value={toDDMMYYYY(value)}
        onValueChange={(values) => {
          const str = values.formattedValue;
          if (str.length === 10 && !str.includes('_')) {
             onChange(toISO(str));
          } else if (str === '') {
             onChange(undefined);
          }
        }}
        placeholder="dd/mm/yyyy"
        readOnly={readOnly}
        style={{
          ...style,
          width: '100%',
          paddingRight: '40px',
          opacity: readOnly ? 0.6 : 1,
          cursor: readOnly ? 'not-allowed' : 'text',
        }}
      />
      <CalendarTodayOutlinedIcon 
        sx={{ 
          position: 'absolute', 
          right: 12, 
          color: '#64748b', 
          fontSize: 18, 
          pointerEvents: 'none',
          zIndex: 1
        }} 
      />
      {!readOnly && (
        <input
          type="date"
          value={toYYYYMMDD(value)}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              onChange(toISO(val));
            } else {
              onChange(undefined);
            }
          }}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: '40px',
            height: '100%',
            opacity: 0, // Make it invisible
            cursor: 'pointer',
            zIndex: 2,
          }}
          title="Chọn ngày"
        />
      )}
    </Box>
  );
};
