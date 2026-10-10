import { Box } from '@mui/material';
import { NumericFormat } from 'react-number-format';
import React from 'react';

export interface CurrencyInputProps {
  value: number;
  onChange: (val: number) => void;
  readOnly?: boolean;
  style?: React.CSSProperties;
  suffix?: string;
  placeholder?: string;
  max?: number;
}

const defaultFieldStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "12px 16px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  color: "#f1f5f9",
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.2s",
};

// Component nhập số tiền có dấu phân cách hàng nghìn và suffix tùy chọn (mặc định VNĐ)
export const CurrencyInput = ({
  value,
  onChange,
  readOnly = false,
  style,
  suffix = 'VNĐ',
  placeholder = '0',
  max,
}: CurrencyInputProps) => {
  return (
    <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <NumericFormat
        value={value === 0 && placeholder ? '' : value}
        onValueChange={(values) => {
          let val = values.floatValue || 0;
          if (max !== undefined && val > max) {
            val = max;
          }
          onChange(val);
        }}
        isAllowed={(values) => {
          const { floatValue } = values;
          if (max !== undefined && floatValue !== undefined) {
            return floatValue <= max;
          }
          return true;
        }}
        thousandSeparator="."
        decimalSeparator=","
        readOnly={readOnly}
        placeholder={placeholder}
        style={{
          ...defaultFieldStyle,
          ...style,
          paddingRight: suffix ? `${(suffix.length * 10) + 20}px` : '12px',
          opacity: readOnly ? 0.6 : 1,
          cursor: readOnly ? 'not-allowed' : 'text',
        }}
      />
      {suffix && (
        <Box
          component="span"
          sx={{
            position: 'absolute',
            right: 12,
            color: '#64748b',
            fontSize: 12,
            fontWeight: 600,
            userSelect: 'none',
            pointerEvents: 'none',
            letterSpacing: '0.5px',
          }}
        >
          {suffix}
        </Box>
      )}
    </Box>
  );
};
