import {
  Box, Typography, Avatar,
  Dialog, TablePagination, Select, MenuItem, Checkbox, ListItemText,
  CircularProgress, Switch
} from "@mui/material";
import { Users, Edit, Trash2, Plus, X, Save, Eye, EyeOff, Search } from "lucide-react";
import useTranslation from '@/hooks/use-translation';
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { userService } from "../../../services/user.service";
import type { UserDto as RawUserDto } from "../../../services/user.service";

// Extended UserDto that works with both ABP and NestJS user shapes
type UserDto = RawUserDto & {
  name?: string;
  surname?: string;
  userName?: string;
  emailAddress?: string;
  roleNames?: string[];
  phoneNumber?: string;
};
import { roleService } from "../../../services/role.service";
import type { RoleDto } from "../../../services/role.service";
import { useSnackbar } from "notistack";

const ROLE_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  admin:    { label: "Quản trị viên", bg: "rgba(239,68,68,0.15)",   color: "#ef4444", border: "rgba(239,68,68,0.4)" },
  operator: { label: "Vận hành viên", bg: "rgba(234,179,8,0.15)",  color: "#eab308", border: "rgba(234,179,8,0.4)" },
  viewer:   { label: "Người xem",     bg: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "rgba(59,130,246,0.4)" },
};

const getRoleDisplay = (roleName: string) => {
  const mapped = ROLE_MAP[roleName.toLowerCase()];
  return mapped || { label: roleName, bg: "rgba(255,255,255,0.1)", color: "#cbd5e1", border: "rgba(255,255,255,0.2)" };
};

const AVATAR_COLORS = ["#06b6d4", "#3b82f6", "#8b5cf6"];

const fieldStyle = {
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

interface UserListProps {
  onUpdateCount?: (count: number) => void;
}

const UserList = ({ onUpdateCount }: UserListProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [draft, setDraft] = useState<Partial<UserDto> & { password?: string; repassword?: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showRepassword, setShowRepassword] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<"all" | "true" | "false">("all");

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await userService.getAll({
        skipCount: page * rowsPerPage,
        maxResultCount: rowsPerPage,
        keyword: searchTerm || undefined,
        isActive: isActiveFilter === "all" ? undefined : isActiveFilter === "true",
      });
      setUsers(res.data);
      setTotalCount(res.total);
      onUpdateCount?.(res.total);
    } catch (error) {
      console.error(t('load_users_error'), error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, searchTerm, isActiveFilter, onUpdateCount]);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await roleService.getAll();
      setAvailableRoles(res.data);
    } catch (error) {
      console.error(t('load_roles_error'), error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleOpenAdd = () => {
    setDraft({ fullName: "", email: "", role: "operator", isActive: true, password: "", repassword: "", name: "", userName: "", surname: "", emailAddress: "", roleNames: [] } as any);
    setModalMode("add");
    setShowPassword(false);
    setShowRepassword(false);
  };

  const handleOpenEdit = (user: UserDto) => {
    setDraft({ ...user, roleNames: user.roleNames || (user.role ? [user.role] : []) } as any);
    setModalMode("edit");
  };

  const handleClose = () => {
    setModalMode(null);
    setDraft(null);
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.userName || !draft.name || !draft.surname || !draft.emailAddress) {
      enqueueSnackbar(t('required_fields_missing'), { variant: 'warning' });
      return;
    }
    
    if (draft.phoneNumber) {
      const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
      if (!phoneRegex.test(draft.phoneNumber)) {
        enqueueSnackbar(t('invalid_phone'), { variant: 'warning' });
        return;
      }
    }
    
    try {
      if (modalMode === "add") {
        if (!draft.password) {
          enqueueSnackbar(t('password_required'), { variant: 'warning' });
          return;
        }
        if (draft.password !== draft.repassword) {
          enqueueSnackbar(t('password_mismatch'), { variant: 'warning' });
          return;
        }
        await userService.create({
          userName: draft.userName,
          name: draft.name,
          surname: draft.surname,
          emailAddress: draft.emailAddress,
          password: draft.password,
          roleNames: draft.roleNames || [],
          isActive: draft.isActive ?? true,
          phoneNumber: draft.phoneNumber,
        });
      } else if (modalMode === "edit") {
        await userService.update({
          id: draft.id,
          userName: draft.userName,
          name: draft.name,
          surname: draft.surname,
          emailAddress: draft.emailAddress,
          roleNames: draft.roleNames || [],
          isActive: draft.isActive ?? true,
          phoneNumber: draft.phoneNumber,
        });
      }
      handleClose();
      fetchUsers();
      enqueueSnackbar(modalMode === "add" ? t('add_success') : t('update_success'), { variant: 'success' });
    } catch (error) {
      const err = error as { response?: { data?: { error?: { message?: string } } }, message?: string };
      enqueueSnackbar(t('save_error') + (err?.response?.data?.error?.message || err?.message || t('unknown_error')), { variant: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm(t('confirm_delete_user'))) {
      try {
        await userService.delete(id);
        fetchUsers();
        enqueueSnackbar(t('delete_success'), { variant: 'success' });
      } catch (error) {
         console.error(error);
         enqueueSnackbar(t('update_status_failed'), { variant: 'error' });
      }
    }
  };

  const handleToggleActive = async (user: UserDto) => {
    try {
      if (user.isActive) {
        await userService.deactivate(user.id);
        enqueueSnackbar(t('deactivate_success'), { variant: 'success' });
      } else {
        await userService.activate(user.id);
        enqueueSnackbar(t('activate_success'), { variant: 'success' });
      }
      fetchUsers();
    } catch (error) {
      console.error(error);
      enqueueSnackbar(t('update_status_failed'), { variant: 'error' });
    }
  };

  const getRoleDisplayName = (roleName: string) => {
    const roleUrlName = roleName.toLowerCase();
    const mapMatch = ROLE_MAP[roleUrlName];
    if (mapMatch) return t("admin_role");
    const fromApi = availableRoles.find(r => r.name.toLowerCase() === roleUrlName || r.displayName.toLowerCase() === roleUrlName);
    return fromApi ? fromApi.displayName : roleName;
  };

  return (
    <>
      <Box sx={{ bgcolor: "rgba(2,6,23,0.85)", backdropFilter: "blur(16px)", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)", p: 2.5, minHeight: 400, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5, flexWrap: { xs: "wrap", xl: "nowrap" }, gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            <Users size={20} color="#00e5ff" />
            <Typography sx={{ color: "#00e5ff", fontWeight: 700, fontSize: 16 }}>{t('user_management')}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, justifyContent: "flex-end", flexWrap: "nowrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, bgcolor: "rgba(255,255,255,0.05)", px: 1.5, py: 0.5, borderRadius: 2, border: "1px solid rgba(255,255,255,0.12)", height: "34px", flex: 1, minWidth: "120px", maxWidth: "220px" }}>
              <Search size={16} color="#94a3b8" />
              <input
                placeholder={t('search_user_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: "transparent", border: "none", color: "#f1f5f9", outline: "none", width: "100%", fontSize: 13 }}
              />
            </Box>

            <Select
              value={isActiveFilter}
              onChange={(e) => setIsActiveFilter(e.target.value as "all" | "true" | "false")}
              sx={{
                bgcolor: "rgba(255,255,255,0.05)", borderRadius: 2, color: "#f1f5f9", height: "34px", fontSize: 13, minWidth: "130px", flexShrink: 0,
                ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.12)" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#00c8ff", borderWidth: 1 },
                ".MuiSelect-select": { py: 0, display: "flex", alignItems: "center", height: "100%" }
              }}
              MenuProps={{ PaperProps: { sx: { bgcolor: "#0f172a", border: "1px solid rgba(0,200,255,0.2)" } } }}
            >
              <MenuItem value="all" sx={{ color: "#e2e8f0", fontSize: 13 }}>{t('all_status')}</MenuItem>
              <MenuItem value="true" sx={{ color: "#e2e8f0", fontSize: 13 }}>{t('active_status')}</MenuItem>
              <MenuItem value="false" sx={{ color: "#e2e8f0", fontSize: 13 }}>{t('inactive_status')}</MenuItem>
            </Select>

            {/* Pagination Inline */}
            {!isLoading && totalCount > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", bgcolor: "rgba(255,255,255,0.03)", borderRadius: 2, border: "1px solid rgba(255,255,255,0.08)", pl: 0.5, pr: 0.5, flexShrink: 0 }}>
                <TablePagination
                  component="div"
                  count={totalCount}
                  page={page}
                  onPageChange={(_e, newPage) => setPage(newPage)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  labelRowsPerPage=""
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
                  sx={{
                    color: "#cbd5e1",
                    overflow: "hidden", borderBottom: "none",
                    ".MuiToolbar-root": { minHeight: "32px !important", p: 0 },
                    ".MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows": { margin: 0, fontSize: 12 },
                    ".MuiTablePagination-select": { color: "#f1f5f9", p: "0 18px 0 0 !important", fontSize: 13 },
                    ".MuiTablePagination-selectIcon": { color: "#00c8ff", right: 0 },
                    ".MuiIconButton-root": { color: "#00c8ff", p: 0.5 },
                    ".Mui-disabled": { color: "rgba(255,255,255,0.1) !important" },
                    ".MuiTablePagination-actions": { ml: 0.5 }
                  }}
                />
              </Box>
            )}

            <Box onClick={handleOpenAdd} component="button" sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 2, py: 1, height: "34px", border: "none", bgcolor: "#00c8ff", color: "#020617", borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: "pointer", "&:hover": { bgcolor: "#00e5ff" }, flexShrink: 0, whiteSpace: "nowrap" }}>
              <Plus size={14} /> {t('add_user')}
            </Box>
          </Box>
        </Box>

        {/* List */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, flex: 1 }}>
          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
              <CircularProgress size={30} sx={{ color: "#00c8ff" }} />
            </Box>
          ) : users.length === 0 ? (
            <Typography sx={{ color: "#64748b", textAlign: "center", py: 5 }}>{t('no_users')}</Typography>
          ) : (
            users.map((user, idx) => {
              return (
                <motion.div
                  key={user.id}
                  whileHover={{ scale: 1.01 }}
                  style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", transition: "background 0.2s, border 0.2s", cursor: "default" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,200,255,0.2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.07)"; }}
                >
                  <Avatar sx={{ width: 40, height: 40, bgcolor: AVATAR_COLORS[idx % AVATAR_COLORS.length], fontWeight: 700, fontSize: 15, mr: 1.75, flexShrink: 0 }}>
                    {(user.fullName || user.name || user.email || '?').charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>{user.fullName || `${user.surname || ''} ${user.name || ''}`.trim() || user.email}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#64748b", mb: 0.75 }}>{user.email || user.emailAddress}</Typography>
                    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
                      {(user.roleNames && user.roleNames.length > 0) || user.role ? (
                        (user.roleNames && user.roleNames.length > 0 ? user.roleNames : [user.role || 'viewer']).map((rn) => {
                          const roleStyle = getRoleDisplay(rn);
                          const apiDisplayName = getRoleDisplayName(rn);
                          return (
                            <Box key={rn} sx={{ px: 1.25, py: 0.25, borderRadius: 1, fontSize: 11, fontWeight: 600, bgcolor: roleStyle.bg, color: roleStyle.color, border: `1px solid ${roleStyle.border}` }}>
                              {apiDisplayName}
                            </Box>
                          );
                        })
                      ) : (
                         <Box sx={{ px: 1.25, py: 0.25, borderRadius: 1, fontSize: 11, fontWeight: 600, bgcolor: "rgba(100,116,139,0.15)", color: "#94a3b8", border: "1px solid rgba(100,116,139,0.3)" }}>Không có vai trò</Box>
                      )}
                      
                      <Box 
                        sx={{ px: 1.25, py: 0.25, borderRadius: 1, fontSize: 11, fontWeight: 600, bgcolor: user.isActive ? "rgba(34,197,94,0.15)" : "rgba(100,116,139,0.15)", color: user.isActive ? "#22c55e" : "#94a3b8", border: user.isActive ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(100,116,139,0.3)" }}
                      >
                        {user.isActive ? t('active_status') : t('inactive_status')}
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                    <Switch
                      size="small"
                      checked={user.isActive}
                      onChange={() => handleToggleActive(user)}
                      sx={{
                        mr: 1,
                        "& .MuiSwitch-switchBase.Mui-checked": { color: "#00c8ff" },
                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#00c8ff" }
                      }}
                    />
                    <Box component="button" onClick={() => handleOpenEdit(user)} sx={{ background: "none", border: "none", cursor: "pointer", p: 0.75, color: "#00c8ff", borderRadius: 1, "&:hover": { bgcolor: "rgba(0,200,255,0.12)" } }}><Edit size={16} /></Box>
                    <Box component="button" onClick={() => handleDelete(user.id)} sx={{ background: "none", border: "none", cursor: "pointer", p: 0.75, color: "#ef4444", borderRadius: 1, "&:hover": { bgcolor: "rgba(239,68,68,0.12)" } }}><Trash2 size={16} /></Box>
                  </Box>
                </motion.div>
              );
            })
          )}
        </Box>
      </Box>

      {/* Add / Edit Modal */}
      <Dialog
        open={!!modalMode}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { bgcolor: "#0d1b2e", border: "1px solid rgba(0,200,255,0.15)", borderRadius: 3, boxShadow: "0 25px 60px rgba(0,0,0,0.8)" },
        }}
        sx={{ "& .MuiDialog-container": { alignItems: "center" } }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, pt: 3, pb: 2 }}>
          <Typography sx={{ color: "#00e5ff", fontWeight: 700, fontSize: 18 }}>
            {modalMode === "add" ? t('add_user') : t('edit_user')}
          </Typography>
          <Box component="button" onClick={handleClose} sx={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", p: 0.5, "&:hover": { color: "#94a3b8" } }}>
            <X size={20} />
          </Box>
        </Box>

        {/* Fields */}
        <Box sx={{ px: 3, pb: 1, display: "flex", flexDirection: "column", gap: 2.5 }}>
          {/* Row 1 */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>{t('username')} <span style={{color: "#ef4444"}}>*</span></Typography>
              <input
                style={{ ...fieldStyle, border: !draft?.userName ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.12)", opacity: modalMode === "edit" ? 0.7 : 1 }}
                value={draft?.userName ?? ""}
                readOnly={modalMode === "edit"}
                onChange={(e) => setDraft((d) => d ? { ...d, userName: e.target.value } : d)}
                onFocus={(e) => { if (modalMode !== "edit") e.target.style.borderColor = "#00c8ff"; }}
                onBlur={(e) => { if (!draft?.userName) { e.target.style.borderColor = "rgba(239,68,68,0.5)"; } else { e.target.style.borderColor = "rgba(255,255,255,0.12)"; } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>{t('email')} <span style={{color: "#ef4444"}}>*</span></Typography>
              <input
                type="email"
                style={{ ...fieldStyle, border: !draft?.emailAddress ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.12)" }}
                value={draft?.emailAddress ?? ""}
                onChange={(e) => setDraft((d) => d ? { ...d, emailAddress: e.target.value } : d)}
                onFocus={(e) => (e.target.style.borderColor = "#00c8ff")}
                onBlur={(e) => { if (!draft?.emailAddress) { e.target.style.borderColor = "rgba(239,68,68,0.5)"; } else { e.target.style.borderColor = "rgba(255,255,255,0.12)"; } }}
              />
            </Box>
          </Box>

          {/* Row 2 */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>{t('surname')} <span style={{color: "#ef4444"}}>*</span></Typography>
              <input
                style={{ ...fieldStyle, border: !draft?.surname ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.12)" }}
                value={draft?.surname ?? ""}
                onChange={(e) => setDraft((d) => d ? { ...d, surname: e.target.value } : d)}
                onFocus={(e) => (e.target.style.borderColor = "#00c8ff")}
                onBlur={(e) => { if (!draft?.surname) { e.target.style.borderColor = "rgba(239,68,68,0.5)"; } else { e.target.style.borderColor = "rgba(255,255,255,0.12)"; } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>{t('first_name')} <span style={{color: "#ef4444"}}>*</span></Typography>
              <input
                style={{ ...fieldStyle, border: !draft?.name ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.12)" }}
                value={draft?.name ?? ""}
                onChange={(e) => setDraft((d) => d ? { ...d, name: e.target.value } : d)}
                onFocus={(e) => (e.target.style.borderColor = "#00c8ff")}
                onBlur={(e) => { if (!draft?.name) { e.target.style.borderColor = "rgba(239,68,68,0.5)"; } else { e.target.style.borderColor = "rgba(255,255,255,0.12)"; } }}
              />
            </Box>
          </Box>

          {/* Row 3: Password (Only Add) */}
          {modalMode === "add" && (
            <Box sx={{ display: "flex", gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>{t('password')} <span style={{color: "#ef4444"}}>*</span></Typography>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    style={{ ...fieldStyle, paddingRight: 40, border: !draft?.password ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.12)" }}
                    value={draft?.password ?? ""}
                    onChange={(e) => setDraft((d) => d ? { ...d, password: e.target.value } : d)}
                    onFocus={(e) => (e.target.style.borderColor = "#00c8ff")}
                    onBlur={(e) => { if (!draft?.password) { e.target.style.borderColor = "rgba(239,68,68,0.5)"; } else { e.target.style.borderColor = "rgba(255,255,255,0.12)"; } }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748b", cursor: "pointer", display: "flex", padding: 0 }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>{t('re_password')} <span style={{color: "#ef4444"}}>*</span></Typography>
                <div style={{ position: "relative" }}>
                  <input
                    type={showRepassword ? "text" : "password"}
                    style={{ ...fieldStyle, paddingRight: 40, border: draft?.repassword && draft.password !== draft.repassword ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.12)" }}
                    value={draft?.repassword ?? ""}
                    onChange={(e) => setDraft((d) => d ? { ...d, repassword: e.target.value } : d)}
                    onFocus={(e) => (e.target.style.borderColor = "#00c8ff")}
                    onBlur={(e) => { if (draft?.repassword && draft.password !== draft.repassword) { e.target.style.borderColor = "rgba(239,68,68,0.5)"; } else { e.target.style.borderColor = "rgba(255,255,255,0.12)"; } }}
                  />
                  <button type="button" onClick={() => setShowRepassword(!showRepassword)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748b", cursor: "pointer", display: "flex", padding: 0 }}>
                    {showRepassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Box>
            </Box>
          )}

          {/* Row 4: Role & Phone */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>{t('role')}</Typography>
              <Select
                multiple
                value={draft?.roleNames || []}
                onChange={(e) => setDraft((d) => d ? { ...d, roleNames: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value } : d)}
                renderValue={(selected) => selected.map(getRoleDisplayName).join(", ")}
                sx={{
                  width: "100%", bgcolor: "rgba(255,255,255,0.05)", borderRadius: "8px", color: "#f1f5f9", height: "45px",
                  ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.12)" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#00c8ff", borderWidth: 1 }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: "#0f172a", border: "1px solid rgba(0,200,255,0.2)" } } }}
              >
                {availableRoles.map((role) => (
                  <MenuItem key={role.name} value={role.name} sx={{ color: "#e2e8f0", "&:hover": { bgcolor: "rgba(0,200,255,0.1)" }, "&.Mui-selected": { bgcolor: "rgba(0,200,255,0.15) !important" } }}>
                    <Checkbox checked={(draft?.roleNames || []).indexOf(role.name) > -1} sx={{ color: "#94a3b8", "&.Mui-checked": { color: "#00c8ff" } }} size="small" />
                    <ListItemText primary={role.displayName} primaryTypographyProps={{ fontSize: 14 }} />
                  </MenuItem>
                ))}
              </Select>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>{t('phone_number')}</Typography>
              <input
                style={fieldStyle}
                value={draft?.phoneNumber ?? ""}
                onChange={(e) => setDraft((d) => d ? { ...d, phoneNumber: e.target.value } : d)}
                onFocus={(e) => (e.target.style.borderColor = "#00c8ff")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
              />
            </Box>
          </Box>
          
        </Box>
        
        {/* Buttons */}
        <Box sx={{ display: "flex", gap: 1.5, pt: 2, px: 3, pb: 3 }}>
          <Box
            component="button"
            onClick={handleSave}
            sx={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75,
              py: 1.25, borderRadius: 2, border: "none", bgcolor: "#00c8ff", color: "#f1f5f9",
              fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
              "&:hover": { bgcolor: "#00e5ff" }
            }}
          >
            <Save size={16} />
            {t('save')}
          </Box>
          <Box
            component="button"
            onClick={handleClose}
            sx={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75,
              py: 1.25, borderRadius: 2, border: "none", bgcolor: "rgba(255,255,255,0.1)", color: "#f1f5f9",
              fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
              "&:hover": { bgcolor: "rgba(255,255,255,0.15)", color: "#ffffff" }
            }}
          >
            {t('cancel')}
          </Box>
        </Box>
      </Dialog>
    </>
  );
};

export default UserList;
