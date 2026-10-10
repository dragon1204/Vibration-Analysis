import {
  Box, Typography, Avatar,
  Dialog, TablePagination, Checkbox,
  CircularProgress, Collapse
} from "@mui/material";
import { ShieldAlert, Edit, Trash2, Plus, X, Save, Search, ChevronRight, ChevronDown } from "lucide-react";
import useTranslation from '@/hooks/use-translation';
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { roleService } from "../../../services/role.service";
import type { RoleDto, FlatPermissionDto } from "../../../services/role.service";
import { useSnackbar } from "notistack";

const AVATAR_COLORS = ["#06b6d4", "#3b82f6", "#8b5cf6", "#f43f5e", "#10b981"];

interface PermissionTreeNode {
  permission: FlatPermissionDto;
  children: PermissionTreeNode[];
}

function buildPermissionTree(permissions: FlatPermissionDto[]): PermissionTreeNode[] {
  const nodeMap = new Map<string, PermissionTreeNode>();
  const roots: PermissionTreeNode[] = [];

  // Tạo node cho mỗi permission
  for (const perm of permissions) {
    nodeMap.set(perm.name, { permission: perm, children: [] });
  }

  // Xây dựng cây
  for (const perm of permissions) {
    const node = nodeMap.get(perm.name)!;
    if (perm.parentName && nodeMap.has(perm.parentName)) {
      nodeMap.get(perm.parentName)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// Lấy tất cả tên permission con (đệ quy)
function getAllDescendantNames(node: PermissionTreeNode): string[] {
  const names: string[] = [];
  for (const child of node.children) {
    names.push(child.permission.name);
    names.push(...getAllDescendantNames(child));
  }
  return names;
}

// Lấy tất cả tên permission cha (đi lên)
function getAllAncestorNames(permName: string, permissions: FlatPermissionDto[]): string[] {
  const names: string[] = [];
  const permMap = new Map<string, FlatPermissionDto>();
  for (const p of permissions) permMap.set(p.name, p);
  
  let current = permMap.get(permName);
  while (current?.parentName && permMap.has(current.parentName)) {
    names.push(current.parentName);
    current = permMap.get(current.parentName);
  }
  return names;
}

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

interface PermissionNodeProps {
  node: PermissionTreeNode;
  depth: number;
  grantedPermissions: string[];
  expandedNodes: Set<string>;
  onTogglePermission: (name: string) => void;
  onToggleExpand: (name: string) => void;
}

const PermissionNodeComponent = ({ node, depth, grantedPermissions, expandedNodes, onTogglePermission, onToggleExpand }: PermissionNodeProps) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.permission.name);
  const isChecked = grantedPermissions.includes(node.permission.name);

  // Kiểm tra trạng thái indeterminate: cha chưa được chọn nhưng có con được chọn
  const descendantNames = getAllDescendantNames(node);
  const someChildrenChecked = descendantNames.some(n => grantedPermissions.includes(n));
  const allChildrenChecked = hasChildren && descendantNames.every(n => grantedPermissions.includes(n));
  const isIndeterminate = isChecked && hasChildren && someChildrenChecked && !allChildrenChecked;

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: depth * 3,
          py: 0.75,
          px: 1,
          borderRadius: 1.5,
          transition: "all 0.15s",
          cursor: "pointer",
          "&:hover": { bgcolor: "rgba(0,200,255,0.05)" },
          ...(depth === 0 && {
            bgcolor: "rgba(255,255,255,0.03)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            mb: 0.5,
          }),
        }}
      >
        {/* Expand/Collapse icon */}
        {hasChildren ? (
          <Box
            onClick={(e) => { e.stopPropagation(); onToggleExpand(node.permission.name); }}
            sx={{ display: "flex", alignItems: "center", p: 0.25, borderRadius: 1, "&:hover": { bgcolor: "rgba(255,255,255,0.08)" } }}
          >
            {isExpanded ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
          </Box>
        ) : (
          <Box sx={{ width: 18.5 }} /> // Spacer khi không có con
        )}

        {/* Checkbox */}
        <Checkbox
          size="small"
          checked={isChecked}
          indeterminate={isIndeterminate}
          onClick={(e) => { e.stopPropagation(); onTogglePermission(node.permission.name); }}
          sx={{
            p: 0,
            color: "#64748b",
            "&.Mui-checked": { color: "#00c8ff" },
            "&.MuiCheckbox-indeterminate": { color: "#00c8ff" },
          }}
        />

        {/* Label */}
        <Box onClick={() => onTogglePermission(node.permission.name)} sx={{ flex: 1, ml: 0.5 }}>
          <Typography sx={{
            color: isChecked ? "#fff" : "#cbd5e1",
            fontSize: depth === 0 ? 13.5 : 13,
            fontWeight: isChecked ? (depth === 0 ? 700 : 600) : (depth === 0 ? 600 : 400),
            lineHeight: 1.4,
          }}>
            {node.permission.displayName}
          </Typography>
          {node.permission.description && (
            <Typography sx={{ color: "#64748b", fontSize: 11, mt: 0.15 }}>{node.permission.description}</Typography>
          )}
        </Box>

        {/* Badge số con */}
        {hasChildren && (
          <Box sx={{
            px: 0.75, py: 0.1, borderRadius: 1,
            fontSize: 10, fontWeight: 600,
            bgcolor: "rgba(0,200,255,0.1)", color: "#00c8ff",
            border: "1px solid rgba(0,200,255,0.2)",
            lineHeight: 1.6,
          }}>
            {node.children.length}
          </Box>
        )}
      </Box>

      {/* Children */}
      {hasChildren && (
        <Collapse in={isExpanded} timeout={200}>
          <Box sx={{ borderLeft: depth < 2 ? "1px solid rgba(255,255,255,0.06)" : "none", ml: depth * 3 + 1.25 }}>
            {node.children.map((child) => (
              <PermissionNodeComponent
                key={child.permission.name}
                node={child}
                depth={depth + 1}
                grantedPermissions={grantedPermissions}
                expandedNodes={expandedNodes}
                onTogglePermission={onTogglePermission}
                onToggleExpand={onToggleExpand}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

interface RoleListProps {
  onUpdateCount?: (count: number) => void;
}

const RoleList = ({ onUpdateCount }: RoleListProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [permissions, setPermissions] = useState<FlatPermissionDto[]>([]);

  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [draft, setDraft] = useState<Partial<RoleDto> | null>(null);
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState("");

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await roleService.getAll({
        skipCount: page * rowsPerPage,
        maxResultCount: rowsPerPage,
        keyword: searchTerm || undefined,
      });
      setRoles(res.data);
      setTotalCount(res.total);
      onUpdateCount?.(res.total);
    } catch (error) {
      console.error(t('load_users_error'), error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, searchTerm, onUpdateCount]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoles();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchRoles]);

  const loadPermissions = async () => {
    try {
      const res = await roleService.getAllPermissions();
      setPermissions(res.data);
    } catch (e) {
      enqueueSnackbar(t('error_load_permissions'), { variant: 'error' });
    }
  };

  const handleOpenAdd = () => {
    setDraft({ name: "", displayName: "", description: "", isDefault: false });
    setGrantedPermissions([]);
    setModalMode("add");
    if (permissions.length === 0) loadPermissions();
  };

  const handleOpenEdit = async (role: RoleDto) => {
    setDraft({ ...role });
    setModalMode("edit");
    try {
      const res = await roleService.getRoleForEdit(role.id);
      setPermissions(res.permissions);
      setGrantedPermissions(res.grantedPermissionNames || []);
      setDraft(res.role as unknown as RoleDto);
    } catch (e) {
      enqueueSnackbar(t('error_load_role'), { variant: 'error' });
    }
  };

  const handleClose = () => {
    setModalMode(null);
    setDraft(null);
    setGrantedPermissions([]);
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name || !draft.displayName) {
      enqueueSnackbar(t('required_fields_missing'), { variant: 'warning' });
      return;
    }

    try {
      if (modalMode === "add") {
        await roleService.create({
          name: draft.name,
          displayName: draft.displayName,
          description: draft.description,
          isDefault: draft.isDefault,
          grantedPermissions: grantedPermissions,
        });
      } else if (modalMode === "edit") {
        await roleService.update({
          id: draft.id as number,
          name: draft.name,
          displayName: draft.displayName,
          description: draft.description,
          isDefault: draft.isDefault,
        }, grantedPermissions);
      }
      handleClose();
      fetchRoles();
      enqueueSnackbar(modalMode === "add" ? t('add_success') : t('update_success'), { variant: 'success' });
    } catch (error) {
      const err = error as any;
      enqueueSnackbar(t('save_error') + (err?.response?.data?.error?.message || err?.message || ""), { variant: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm(t('confirm_delete_role'))) {
      try {
        await roleService.delete(id);
        fetchRoles();
        enqueueSnackbar(t('delete_success'), { variant: 'success' });
      } catch (error) {
        enqueueSnackbar(t('delete_failed'), { variant: 'error' });
      }
    }
  };

  const permissionTree = useMemo(() => buildPermissionTree(permissions), [permissions]);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Mở rộng tất cả khi permissions thay đổi
  useEffect(() => {
    if (permissions.length > 0) {
      setExpandedNodes(new Set(permissions.map(p => p.name)));
    }
  }, [permissions]);

  const toggleExpand = (name: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const togglePermission = (name: string) => {
    const nodeMap = new Map<string, PermissionTreeNode>();
    const buildMap = (nodes: PermissionTreeNode[]) => {
      for (const n of nodes) {
        nodeMap.set(n.permission.name, n);
        buildMap(n.children);
      }
    };
    buildMap(permissionTree);

    const node = nodeMap.get(name);
    if (!node) return;

    const isCurrentlyGranted = grantedPermissions.includes(name);
    let updated = [...grantedPermissions];

    if (isCurrentlyGranted) {
      // Bỏ chọn: bỏ chính nó + tất cả con
      const toRemove = new Set([name, ...getAllDescendantNames(node)]);
      updated = updated.filter(p => !toRemove.has(p));
    } else {
      // Chọn: thêm chính nó + tất cả cha (để đảm bảo cha luôn được chọn)
      const ancestors = getAllAncestorNames(name, permissions);
      const toAdd = new Set([name, ...ancestors]);
      for (const a of toAdd) {
        if (!updated.includes(a)) updated.push(a);
      }
    }

    setGrantedPermissions(updated);
  };

  return (
    <>
      <Box sx={{ bgcolor: "rgba(2,6,23,0.85)", backdropFilter: "blur(16px)", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)", p: 2.5, minHeight: 400, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5, flexWrap: { xs: "wrap", xl: "nowrap" }, gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            <ShieldAlert size={20} color="#00e5ff" />
            <Typography sx={{ color: "#00e5ff", fontWeight: 700, fontSize: 16 }}>{t('role_management')}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, justifyContent: "flex-end", flexWrap: "nowrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, bgcolor: "rgba(255,255,255,0.05)", px: 1.5, py: 0.5, borderRadius: 2, border: "1px solid rgba(255,255,255,0.12)", height: "34px", flex: 1, minWidth: "120px", maxWidth: "220px" }}>
              <Search size={16} color="#94a3b8" />
              <input
                placeholder={t('search_role_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: "transparent", border: "none", color: "#f1f5f9", outline: "none", width: "100%", fontSize: 13 }}
              />
            </Box>

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
              <Plus size={14} /> {t('add_role')}
            </Box>
          </Box>
        </Box>

        {/* List */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, flex: 1 }}>
          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
              <CircularProgress size={30} sx={{ color: "#00c8ff" }} />
            </Box>
          ) : roles.length === 0 ? (
            <Typography sx={{ color: "#64748b", textAlign: "center", py: 5 }}>{t('no_roles')}</Typography>
          ) : (
            roles.map((role, idx) => {
              return (
                <motion.div
                  key={role.id}
                  whileHover={{ scale: 1.01 }}
                  style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", transition: "background 0.2s, border 0.2s", cursor: "default" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,200,255,0.2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.07)"; }}
                >
                  <Avatar sx={{ width: 40, height: 40, bgcolor: AVATAR_COLORS[idx % AVATAR_COLORS.length], fontWeight: 700, fontSize: 15, mr: 1.75, flexShrink: 0 }}>
                    {role.displayName.charAt(0)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>{role.displayName}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#64748b", mb: 0.75 }}>Code: {role.name} {role.description ? `- ${role.description}` : ''}</Typography>
                    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>

                      {role.isStatic && (
                        <Box sx={{ px: 1.25, py: 0.25, borderRadius: 1, fontSize: 11, fontWeight: 600, bgcolor: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)" }}>Hệ thống</Box>
                      )}

                      {role.isDefault && (
                        <Box sx={{ px: 1.25, py: 0.25, borderRadius: 1, fontSize: 11, fontWeight: 600, bgcolor: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.4)" }}>Mặc định</Box>
                      )}

                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                    <Box component="button" onClick={() => handleOpenEdit(role)} sx={{ background: "none", border: "none", cursor: "pointer", p: 0.75, color: "#00c8ff", borderRadius: 1, "&:hover": { bgcolor: "rgba(0,200,255,0.12)" } }}><Edit size={16} /></Box>
                    {!role.isStatic && (
                      <Box component="button" onClick={() => handleDelete(role.id)} sx={{ background: "none", border: "none", cursor: "pointer", p: 0.75, color: "#ef4444", borderRadius: 1, "&:hover": { bgcolor: "rgba(239,68,68,0.12)" } }}><Trash2 size={16} /></Box>
                    )}
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
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: "#0d1b2e", border: "1px solid rgba(0,200,255,0.15)", borderRadius: 3, boxShadow: "0 25px 60px rgba(0,0,0,0.8)" },
        }}
        sx={{ "& .MuiDialog-container": { alignItems: "center" } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, pt: 3, pb: 2 }}>
          <Typography sx={{ color: "#00e5ff", fontWeight: 700, fontSize: 18 }}>
            {modalMode === "add" ? t('add_role') : t('edit_role')}
          </Typography>
          <Box component="button" onClick={handleClose} sx={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", p: 0.5, "&:hover": { color: "#94a3b8" } }}>
            <X size={20} />
          </Box>
        </Box>

        <Box sx={{ px: 3, pb: 1, display: "flex", flexDirection: "column", gap: 2.5 }}>
          {/* Row 1 */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Tên vai trò (hiển thị) <span style={{ color: "#ef4444" }}>*</span></Typography>
              <input
                style={{ ...fieldStyle, border: !draft?.displayName ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.12)" }}
                value={draft?.displayName ?? ""}
                onChange={(e) => setDraft((d) => d ? { ...d, displayName: e.target.value } : d)}
                onFocus={(e) => (e.target.style.borderColor = "#00c8ff")}
                onBlur={(e) => { if (!draft?.displayName) { e.target.style.borderColor = "rgba(239,68,68,0.5)"; } else { e.target.style.borderColor = "rgba(255,255,255,0.12)"; } }}
              />
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Mã vai trò (Name) <span style={{ color: "#ef4444" }}>*</span></Typography>
              <input
                style={{ ...fieldStyle, border: !draft?.name ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.12)", opacity: modalMode === "edit" ? 0.7 : 1 }}
                value={draft?.name ?? ""}
                readOnly={modalMode === "edit"} // Không cho sửa code nếu đang edit.
                onChange={(e) => setDraft((d) => d ? { ...d, name: e.target.value } : d)}
                onFocus={(e) => { if (modalMode !== "edit") e.target.style.borderColor = "#00c8ff"; }}
                onBlur={(e) => { if (!draft?.name) { e.target.style.borderColor = "rgba(239,68,68,0.5)"; } else { e.target.style.borderColor = "rgba(255,255,255,0.12)"; } }}
              />
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>Mô tả</Typography>
              <input
                style={{ ...fieldStyle }}
                value={draft?.description ?? ""}
                onChange={(e) => setDraft((d) => d ? { ...d, description: e.target.value } : d)}
                onFocus={(e) => (e.target.style.borderColor = "#00c8ff")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
              />
            </Box>
          </Box>

          <Box>
            <Box sx={{ display: "flex", alignItems: "center", cursor: "pointer", width: "max-content", gap: 1 }} onClick={() => setDraft((d) => d ? { ...d, isDefault: !d.isDefault } : d)}>
              <Checkbox checked={draft?.isDefault ?? false} sx={{ p: 0, color: "#94a3b8", "&.Mui-checked": { color: "#00c8ff" } }} />
              <Typography sx={{ color: "#e2e8f0", fontSize: 14 }}>Là vai trò mặc định (Gán cho user mới)</Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, pb: 1, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>Phân quyền chức năng</Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Box
                  component="button"
                  onClick={() => setExpandedNodes(new Set(permissions.map(p => p.name)))}
                  sx={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 1.5, px: 1.5, py: 0.5, color: "#94a3b8", fontSize: 11, cursor: "pointer", "&:hover": { color: "#00c8ff", borderColor: "rgba(0,200,255,0.3)" } }}
                >
                  Mở tất cả
                </Box>
                <Box
                  component="button"
                  onClick={() => setExpandedNodes(new Set())}
                  sx={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 1.5, px: 1.5, py: 0.5, color: "#94a3b8", fontSize: 11, cursor: "pointer", "&:hover": { color: "#00c8ff", borderColor: "rgba(0,200,255,0.3)" } }}
                >
                  Thu tất cả
                </Box>
              </Box>
            </Box>
            <Box sx={{
              maxHeight: 350,
              overflowY: "auto",
              pr: 0.5,
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "3px" },
            }}>
              {permissionTree.map((node) => (
                <PermissionNodeComponent
                  key={node.permission.name}
                  node={node}
                  depth={0}
                  grantedPermissions={grantedPermissions}
                  expandedNodes={expandedNodes}
                  onTogglePermission={togglePermission}
                  onToggleExpand={toggleExpand}
                />
              ))}
            </Box>
          </Box>

        </Box>

        <Box sx={{ display: "flex", gap: 1.5, pt: 2, px: 3, pb: 3, mt: 1 }}>
          <Box
            component="button"
            onClick={handleSave}
            sx={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75,
              py: 1.25, borderRadius: 2, border: "none", bgcolor: "#00c8ff", color: "#020617",
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

export default RoleList;
