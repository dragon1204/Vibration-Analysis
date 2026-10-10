import { Box, Typography } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

interface MenuItemProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  active?: boolean;
  open?: boolean;
  onClick?: () => void;
  hasChildren?: boolean;
  bgcolor?: string;
  borderColor?: string;
  iconColor?: string;
}

const MenuItem = ({ icon: Icon, label, active, open, onClick, hasChildren, bgcolor, borderColor, iconColor }: MenuItemProps) => {
  return (
    <Box
      onClick={onClick}
      sx={{
        height: 38,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1.25,
        borderRadius: 2.5,
        cursor: "pointer",
        bgcolor: active ? bgcolor : "transparent",
        border: active ? `1px solid ${borderColor}` : "1px solid transparent",
        ...(!active && {
          "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
        }),
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          color: active ? iconColor : "#94a3b8",
          "& svg": {
            width: 18,
            height: 18,
          },
        }}
      >
        <Icon />
      </Box>

      <Typography
        sx={{
          flexGrow: 1,
          fontSize: 12,
          fontWeight: 600,
          color: active ? "#fff" : "#cbd5f5",
        }}
      >
        {label}
      </Typography>

      {hasChildren &&
        (open ? (
          <KeyboardArrowUpIcon sx={{ fontSize: 18, color: iconColor }} />
        ) : (
          <KeyboardArrowDownIcon sx={{ fontSize: 18, color: "#94a3b8" }} />
        ))}
    </Box>
  );
};

export default MenuItem;
