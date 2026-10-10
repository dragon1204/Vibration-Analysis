import { Box, Typography, Switch } from "@mui/material";
import { Bell, Edit, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

interface AlertConfig {
  id: string;
  systemType: string;
  threshold: number;
  severity: "critical" | "high" | "medium";
  enabled: boolean;
}

const INITIAL_ALERTS: AlertConfig[] = [
  { id: "A001", systemType: "BMS",  threshold: 28,    severity: "critical", enabled: true },
  { id: "A002", systemType: "EMS",  threshold: 10000, severity: "high",     enabled: true },
  { id: "A003", systemType: "CCTV", threshold: 5,     severity: "medium",   enabled: true },
];

const SEVERITY_MAP = {
  critical: { label: "Nghiêm trọng", bg: "rgba(239,68,68,0.2)",  color: "#ef4444" },
  high:     { label: "Cao",          bg: "rgba(249,115,22,0.2)", color: "#f97316" },
  medium:   { label: "Trung bình",   bg: "rgba(202,138,4,0.2)",  color: "#ca8a04" },
};

const AlertList = () => {
  const [alerts, setAlerts] = useState<AlertConfig[]>(INITIAL_ALERTS);

  const handleToggle = (id: string) => {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  };

  return (
    <Box
      sx={{
        bgcolor: "rgba(2, 6, 23, 0.85)",
        backdropFilter: "blur(16px)",
        borderRadius: 3,
        border: "1px solid rgba(255,255,255,0.08)",
        p: 2.5,
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Bell size={20} color="#00e5ff" />
          <Typography sx={{ color: "#00e5ff", fontWeight: 700, fontSize: 16 }}>
            Cấu Hình Cảnh Báo
          </Typography>
        </Box>
        <Box
          component="button"
          sx={{
            display: "flex", alignItems: "center", gap: 0.75,
            px: 2, py: 1,
            bgcolor: "#00c8ff", color: "#020617",
            border: "none", borderRadius: 2,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            transition: "all 0.2s",
            "&:hover": { bgcolor: "#00e5ff", transform: "translateY(-1px)" },
          }}
        >
          <Plus size={14} />
          Thêm Quy Tắc
        </Box>
      </Box>

      {/* List */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {alerts.map((item) => {
          const sev = SEVERITY_MAP[item.severity];
          return (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.01 }}
              style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", transition: "background 0.2s, border 0.2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,200,255,0.2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.07)"; }}
            >
              {/* Info */}
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.75 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
                    {item.systemType}
                  </Typography>
                  <Box sx={{ px: 1.25, py: 0.2, borderRadius: 1, fontSize: 11, fontWeight: 600, bgcolor: sev.bg, color: sev.color }}>
                    {sev.label}
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 13, color: "#64748b" }}>
                  Ngưỡng cảnh báo:{" "}
                  <Box component="span" sx={{ color: "#cbd5e1", fontWeight: 600 }}>
                    {item.threshold}
                  </Box>
                </Typography>
              </Box>

              {/* Actions */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Switch
                  checked={item.enabled}
                  onChange={() => handleToggle(item.id)}
                  size="small"
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": { color: "#00c8ff" },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#00c8ff" },
                  }}
                />
                <Box component="button" sx={{ background: "none", border: "none", cursor: "pointer", p: 0.5, color: "#00c8ff", "&:hover": { opacity: 0.7 } }}>
                  <Edit size={16} />
                </Box>
                <Box component="button" sx={{ background: "none", border: "none", cursor: "pointer", p: 0.5, color: "#ef4444", "&:hover": { opacity: 0.7 } }}>
                  <Trash2 size={16} />
                </Box>
              </Box>
            </motion.div>
          );
        })}
      </Box>
    </Box>
  );
};

export default AlertList;
