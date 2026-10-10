import { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';

export interface SelectOption {
  value: number | string;
  label: string;
}

interface SearchableSelectProps {
  /** Giá trị hiện tại (id) */
  value?: number | string | null;
  /** Placeholder khi chưa chọn */
  placeholder?: string;
  /** Readonly/disabled */
  disabled?: boolean;
  /** Callback khi chọn xong */
  onChange: (value: number | string | null) => void;
  /**
   * Hàm fetch options từ server.
   * Nhận keyword (có thể rỗng) → trả về mảng options.
   */
  fetchOptions: (keyword: string) => Promise<SelectOption[]>;
  /**
   * Label tương ứng với value hiện tại.
   * Nếu không truyền hoặc undefined, component sẽ tự fetch để resolve label.
   */
  selectedLabel?: string;
  /** Cho phép xóa selection */
  clearable?: boolean;
  /** Style object áp dụng cho wrapper */
  style?: React.CSSProperties;
  /** thêm class */
  className?: string;
  /** 'small' = 38px height, 'medium' (default) = 45px */
  size?: 'small' | 'medium';
}

const DEBOUNCE_MS = 350;

export const SearchableSelect = ({
  value,
  placeholder = '-- Chọn --',
  disabled = false,
  onChange,
  fetchOptions,
  selectedLabel,
  clearable = true,
  style,
  className,
  size = 'medium',
}: SearchableSelectProps) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [displayLabel, setDisplayLabel] = useState<string>(selectedLabel ?? '');
  // Track liệu đã auto-resolve label chưa (tránh fetch nhiều lần)
  const labelResolvedRef = useRef(!!selectedLabel);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Giữ reference mới nhất của fetchOptions mà không gây re-render / infinite loop
  const fetchOptionsRef = useRef(fetchOptions);
  useEffect(() => {
    fetchOptionsRef.current = fetchOptions;
  });

  // ─── Auto-resolve label khi value thay đổi (edit/view mode hoặc chọn kho) ──────
  useEffect(() => {
    const hasValue = value !== undefined && value !== null && value !== '' && Number(value) !== 0;
    
    // Nếu có value nhưng chưa có label hiển thị hoàn chỉnh
    if (hasValue) {
      // Nếu label hiện tại không khớp hoặc chưa được resolve, đánh dấu để resolve lại
      setOptions([]); // Xóa cache cũ để fetch mới cho ID mới
      labelResolvedRef.current = false; 

      const resolve = async () => {
        try {
          const opts = await fetchOptionsRef.current('');
          setOptions(opts); 
          const found = opts.find((o) => String(o.value) === String(value));
          if (found) {
            setDisplayLabel(found.label);
            labelResolvedRef.current = true;
          }
        } catch (e) {
          console.error(e);
        }
      };
      
      if (!selectedLabel) {
        setDisplayLabel(''); // Xóa nhãn cũ ngay lập tức để không bị hiển thị sai
        resolve();
      }
    }
  }, [selectedLabel, value]); 

  // ─── Đồng bộ selectedLabel từ prop (khi parent cập nhật sau) ────────────────
  useEffect(() => {
    if (selectedLabel) {
      setDisplayLabel(selectedLabel);
      labelResolvedRef.current = true;
    } else if (selectedLabel === '' || selectedLabel === null) {
      // Cho phép reset nhãn từ bên ngoài
      setDisplayLabel('');
    }
  }, [selectedLabel]);

  // ─── Reset khi value bị xóa ───────────────────────────────────────────────
  useEffect(() => {
    const hasValue = value !== undefined && value !== null && value !== '' && Number(value) !== 0;
    if (!hasValue) {
      setDisplayLabel('');
      labelResolvedRef.current = false;
    }
  }, [value]);

  // ─── Đóng khi click ngoài ─────────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setKeyword('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Focus & load options khi mở dropdown ─────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      // Nếu đã pre-populate thì dùng luôn, nếu chưa thì fetch
      if (options.length === 0) {
        doFetch('');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const doFetch = async (kw: string) => {
    setLoading(true);
    try {
      const result = await fetchOptionsRef.current(kw);
      setOptions(result);
      // Nếu vẫn chưa resolve label, thử tìm trong kết quả mới
      if (value && !displayLabel) {
        const found = result.find((o) => String(o.value) === String(value));
        if (found) setDisplayLabel(found.label);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const kw = e.target.value;
    setKeyword(kw);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      doFetch(kw);
    }, DEBOUNCE_MS);
  };

  const handleSelect = (opt: SelectOption) => {
    onChange(opt.value);
    setDisplayLabel(opt.label);
    labelResolvedRef.current = true;
    setOpen(false);
    setKeyword('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setDisplayLabel('');
    labelResolvedRef.current = false;
  };

  const hasValue = value !== undefined && value !== null && value !== '' && Number(value) !== 0;

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={{ position: 'relative', width: '100%', ...style }}
    >
      {/* Trigger button */}
      <Box
        onClick={() => !disabled && setOpen((v) => !v)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          boxSizing: 'border-box',
          padding: size === 'small' ? '6px 12px' : '10px 12px',
          background: disabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(0,184,219,0.5)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: '8px',
          color: hasValue ? '#f1f5f9' : '#64748b',
          fontSize: size === 'small' ? '13px' : '14px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'border-color 0.2s, box-shadow 0.2s',
          boxShadow: open ? '0 0 0 2px rgba(0,184,219,0.15)' : 'none',
          userSelect: 'none',
          minHeight: size === 'small' ? 38 : 45,
          gap: 1,
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: size === 'small' ? 13 : 14,
            color: hasValue ? '#f1f5f9' : '#64748b',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {hasValue ? (displayLabel || <span style={{ color: '#64748b', fontStyle: 'italic' }}>Đang tải...</span>) : placeholder}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {hasValue && clearable && !disabled && (
            <Box
              component="span"
              onClick={handleClear}
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: '#64748b',
                '&:hover': { color: '#ef4444' },
                transition: 'color 0.15s',
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </Box>
          )}
          <KeyboardArrowDownIcon
            sx={{
              fontSize: 18,
              color: '#64748b',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          />
        </Box>
      </Box>

      {/* Dropdown panel */}
      {open && (
        <Box
          sx={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1500,
            bgcolor: '#0f1e32',
            border: '1px solid rgba(0,184,219,0.3)',
            borderRadius: '10px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}
        >
          {/* Search input */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 1.5,
              py: 1,
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              gap: 1,
            }}
          >
            <SearchIcon sx={{ fontSize: 16, color: '#64748b', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={keyword}
              onChange={handleKeywordChange}
              placeholder="Tìm kiếm..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#e2e8f0',
                fontSize: 13,
                padding: '2px 0',
              }}
            />
            {loading && <CircularProgress size={14} sx={{ color: '#00B8DB', flexShrink: 0 }} />}
          </Box>

          {/* Options list */}
          <Box
            sx={{
              maxHeight: 240,
              overflowY: 'auto',
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '4px',
              },
            }}
          >
            {!loading && options.length === 0 && (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography sx={{ color: '#64748b', fontSize: 13 }}>
                  {keyword ? 'Không tìm thấy kết quả' : 'Không có dữ liệu'}
                </Typography>
              </Box>
            )}

            {/* Option: clear selection */}
            {clearable && (
              <Box
                onClick={() => { onChange(null); setDisplayLabel(''); labelResolvedRef.current = false; setOpen(false); setKeyword(''); }}
                sx={{
                  px: 2,
                  py: 1.2,
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: 13,
                  fontStyle: 'italic',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', color: '#94a3b8' },
                }}
              >
                {placeholder}
              </Box>
            )}

            {options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <Box
                  key={opt.value}
                  onClick={() => handleSelect(opt)}
                  sx={{
                    px: 2,
                    py: 1.2,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: isSelected ? '#00B8DB' : '#e2e8f0',
                    bgcolor: isSelected ? 'rgba(0,184,219,0.08)' : 'transparent',
                    fontWeight: isSelected ? 600 : 400,
                    '&:hover': {
                      bgcolor: isSelected
                        ? 'rgba(0,184,219,0.12)'
                        : 'rgba(255,255,255,0.05)',
                    },
                    transition: 'background-color 0.15s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                  {isSelected && (
                    <Box
                      component="span"
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: '#00B8DB',
                        flexShrink: 0,
                        ml: 1,
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};
