import { Box, Typography, Switch, CircularProgress } from "@mui/material";
import { Building2, Edit, Trash2, Plus, MapPin, Layers } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSnackbar } from "notistack";

import buildingService, { type Building } from "@/services/urban/building.service";
import urbanService, { type Urban } from "@/services/urban/urban.service";
import { BMS_DEVICE_TYPES, CCTV_DEVICE_TYPES, EMS_DEVICE_TYPES } from "@/constants/device-systems";

interface BuildingListProps {
  onUpdateCount?: (count: number) => void;
}

/** Determine which subsystems a building has based on its device types */
const getActiveSystems = (building: any): string[] => {
  const devices: any[] = building.floors?.flatMap((f: any) => f.devices || []) || [];
  const types = new Set(devices.map((d: any) => d.type));

  const systems: string[] = [];
  if ([...types].some((t) => BMS_DEVICE_TYPES.includes(t as any))) systems.push('BMS');
  if ([...types].some((t) => CCTV_DEVICE_TYPES.includes(t as any))) systems.push('CCTV');
  if ([...types].some((t) => EMS_DEVICE_TYPES.includes(t as any))) systems.push('EMS');
  return systems;
};

const SYSTEM_COLORS: Record<string, string> = {
  BMS: '#8b5cf6',
  CCTV: '#ef4444',
  EMS: '#fbbf24',
  ACS: '#3b82f6',
};

const BuildingList = ({ onUpdateCount }: BuildingListProps) => {
  const { enqueueSnackbar } = useSnackbar();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [urbans, setUrbans] = useState<Urban[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bData, uData] = await Promise.all([
        buildingService.getBuildings(),
        urbanService.getAllUrban(),
      ]);
      const bList = Array.isArray(bData) ? bData : [];
      setBuildings(bList);
      setUrbans(Array.isArray(uData) ? uData : []);
      onUpdateCount?.(bList.length);
    } catch {
      enqueueSnackbar("Lỗi tải dữ liệu", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Xóa tòa nhà này? Tất cả tầng và thiết bị bên trong cũng sẽ bị xóa.")) return;
    try {
      await buildingService.deleteBuilding(id);
      enqueueSnackbar("Xóa thành công", { variant: "success" });
      fetchData();
    } catch {
      enqueueSnackbar("Lỗi khi xóa", { variant: "error" });
    }
  };

  const getUrbanName = (urbanId?: number) => {
    return urbans.find((u) => u.id === urbanId)?.name || "";
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "#00e5ff" }} />
      </Box>
    );
  }

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
          <Building2 size={20} color="#00e5ff" />
          <Typography sx={{ color: "#00e5ff", fontWeight: 700, fontSize: 16 }}>
            Quản Lý Tòa Nhà
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 12, ml: 1 }}>
            {buildings.length} tòa nhà
          </Typography>
        </Box>
      </Box>

      {/* Grid */}
      {buildings.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Building2 size={48} color="#475569" />
          <Typography sx={{ color: "#64748b", fontSize: 14, mt: 2 }}>
            Chưa có tòa nhà nào
          </Typography>
          <Typography sx={{ color: "#475569", fontSize: 12, mt: 0.5 }}>
            Vào IOC → Quản lý Tòa nhà để thêm mới
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 2 }}>
          {buildings.map((building) => (
            <motion.div
              key={building.id}
              whileHover={{ scale: 1.01 }}
              style={{
                borderRadius: 12,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                transition: "background 0.2s, border 0.2s",
              }}
            >
              {/* Card header */}
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", mb: 0.25 }}>
                    {building.name}
                  </Typography>
                  {(building.urban?.name || getUrbanName(building.urbanId)) && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <MapPin size={11} color="#64748b" />
                      <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                        {building.urban?.name || getUrbanName(building.urbanId)}
                        {building.address ? ` — ${building.address}` : ''}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box
                  sx={{
                    display: "flex", alignItems: "center", gap: 0.5,
                    px: 1, py: 0.3, borderRadius: 1,
                    bgcolor: "rgba(0,200,255,0.1)",
                  }}
                >
                  <Layers size={12} color="#00e5ff" />
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#00e5ff" }}>
                    {building.totalFloors || building._count?.floors || 0} tầng
                  </Typography>
                </Box>
              </Box>

              {/* Info row */}
              <Box sx={{ display: "flex", gap: 2, fontSize: 12, color: "#94a3b8" }}>
                {building.code && (
                  <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                    Mã: <span style={{ color: "#94a3b8", fontWeight: 600 }}>{building.code}</span>
                  </Typography>
                )}
                {building.slug && (
                  <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                    Slug: <span style={{ color: "#94a3b8" }}>{building.slug}</span>
                  </Typography>
                )}
              </Box>

              {/* Actions */}
              <Box sx={{ display: "flex", gap: 1, mt: 0.5, pt: 1.5, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <Box
                  component="button"
                  sx={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75,
                    py: 1, borderRadius: 1.5,
                    bgcolor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#cbd5e1", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.2s",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
                  }}
                  onClick={() => {
                    // Navigate to IOC building management for editing
                    enqueueSnackbar("Vui lòng vào IOC → Quản lý Tòa nhà để chỉnh sửa", { variant: "info" });
                  }}
                >
                  <Edit size={14} />
                  Chỉnh sửa
                </Box>
                <Box
                  component="button"
                  onClick={() => handleDelete(building.id)}
                  sx={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75,
                    py: 1, borderRadius: 1.5,
                    bgcolor: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                    color: "#ef4444", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.2s",
                    "&:hover": { bgcolor: "rgba(239,68,68,0.25)" },
                  }}
                >
                  <Trash2 size={14} />
                  Xóa
                </Box>
              </Box>
            </motion.div>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default BuildingList;
