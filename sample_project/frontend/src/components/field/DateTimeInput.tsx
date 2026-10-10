import { Box } from '@mui/material';
import { PatternFormat } from 'react-number-format';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';

const toDisplay = (val?: string | Date | null) => {
  if (!val) return '';
  const date = val instanceof Date ? val : new Date(val);
  if (isNaN(date.getTime())) return '';
  
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  
  return `${d}/${m}/${y} ${h}:${min}`;
};

const toValue = (val?: string | Date | null) => {
  if (!val) return '';
  const date = val instanceof Date ? val : new Date(val);
  if (isNaN(date.getTime())) return '';
  
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  
  return `${y}-${m}-${d}T${h}:${min}`;
};

const toISO = (valStr: string) => {
  if (!valStr) return undefined;
  
  // Handling standard datetime-local value (YYYY-MM-DDTHH:mm) OR ISO string
  if (valStr.includes('T')) {
    const d = new Date(valStr);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  // Handling pattern format (DD/MM/YYYY HH:mm)
  const [datePart, timePart] = valStr.split(' ');
  if (!datePart || !timePart) return undefined;
  
  const dParts = datePart.split('/');
  const tParts = timePart.split(':');
  if (dParts.length !== 3 || tParts.length !== 2) return undefined;
  
  const [day, month, year] = dParts.map(p => parseInt(p, 10));
  const [hour, min] = tParts.map(p => parseInt(p, 10));
  
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return undefined;
  if (hour < 0 || hour > 23 || min < 0 || min > 59) return undefined;

  const date = new Date(year, month - 1, day, hour, min);
  return date.toISOString();
};

export const DateTimeInput = ({
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
        format="##/##/#### ##:##"
        mask="_"
        value={toDisplay(value)}
        onValueChange={(values) => {
          const str = values.formattedValue;
          if (str.length === 16 && !str.includes('_')) {
             onChange(toISO(str));
          } else if (str === '') {
             onChange(undefined);
          }
        }}
        placeholder="dd/mm/yyyy hh:mm"
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
          type="datetime-local"
          value={toValue(value)}
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
          title="Chọn ngày và giờ"
        />
      )}
    </Box>
  );
};
