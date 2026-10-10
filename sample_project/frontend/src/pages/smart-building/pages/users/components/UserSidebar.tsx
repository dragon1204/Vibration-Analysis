import { Box, Typography, useTheme } from "@mui/material";
import { Users, Bell, Building2, ShieldCheck } from "lucide-react";
import useTranslation from '@/hooks/use-translation';

interface UserSidebarProps {
  activeMenu: string;
  onMenuClick: (id: string) => void;
  usersCount?: number;
  rolesCount?: number;
  buildingsCount?: number;
}

const UserSidebar = ({ activeMenu, onMenuClick, usersCount = 0, rolesCount = 0, buildingsCount = 0 }: UserSidebarProps) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const USERSMENU = [
    {
      id: "users",
      label: "users_menu",
      icon: Users,
      count: usersCount,
      countLabel: "users_count",
    },
    {
      id: "alerts",
      label: "alerts_menu",
      icon: Bell,
      count: 3,
      countLabel: "alerts_count",
    },
    {
      id: "buildings",
      label: "buildings_menu",
      icon: Building2,
      count: buildingsCount,
      countLabel: "buildings_count",
    },
    {
      id: "roles",
      label: "roles_menu",
      icon: ShieldCheck,
      count: rolesCount,
      countLabel: "roles_count",
    },
  ];

  return (
    <Box
      sx={{
        width: 260,
        height: "calc(100vh - 110px)",
        position: "absolute",
        left: 24,
        top: 80,
        display: "flex",
        flexDirection: "column",
        bgcolor: "rgba(2, 6, 23, 0.88)",
        backdropFilter: "blur(16px)",
        borderRadius: 3,
        border: `1px solid ${theme.palette.base?.whiteAlpha?.[100] ?? "rgba(255,255,255,0.1)"}`,
        boxShadow: `0 20px 60px rgba(0,0,0,0.6)`,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          gap: 1,
          display: "flex",
          alignItems: "center",
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
        }}
      >
        <Users size={16} color="#00e5ff" />
        <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>
          {t('admin_system')}
        </Typography>
      </Box>

      {/* Menu items */}
      <Box
        sx={{
          flex: 1,
          px: 1.5,
          py: 1.25,
          overflowY: "auto",
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "rgba(255,255,255,0.15)",
            borderRadius: "3px",
          },
        }}
      >
        {USERSMENU.map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.id;
          return (
            <Box
              key={item.id}
              onClick={() => onMenuClick(item.id)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 2,
                py: 1.5,
                borderRadius: 2.5,
                cursor: "pointer",
                mb: 0.5,
                bgcolor: isActive ? "rgba(0,200,255,0.18)" : "transparent",
                border: isActive
                  ? "1px solid rgba(0,200,255,0.4)"
                  : "1px solid transparent",
                transition: "all 0.2s ease",
                ...(!isActive && {
                  "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
                }),
              }}
            >
              {/* Icon */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: isActive ? "#00e5ff" : "#94a3b8",
                  "& svg": { width: 20, height: 20 },
                }}
              >
                <Icon />
              </Box>

              {/* Label + count */}
              <Box>
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isActive ? "#fff" : "#cbd5e1",
                    lineHeight: 1.2,
                  }}
                >
                  {t(item.label as "users_menu")}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 11,
                    color: isActive ? "rgba(0,229,255,0.8)" : "#64748b",
                    mt: 0.25,
                  }}
                >
                  {item.count} {t(item.countLabel as "users_count")}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      {/* <Box
        sx={{
          px: 2.5,
          py: 2,
          borderTop: `1px solid rgba(255,255,255,0.08)`,
          bgcolor: "rgba(2, 6, 23, 0.9)",
        }}
      >
        <Typography sx={{ fontSize: 11, color: "#94a3b8", mb: 0.5 }}>
          USER SYSTEM STATUS
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "#22c55e",
              boxShadow: "0 0 8px rgba(34,197,94,0.8)",
            }}
          />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#22c55e" }}>
            Online
          </Typography>
        </Box>
      </Box> */}
    </Box>
  );
};

export default UserSidebar;
