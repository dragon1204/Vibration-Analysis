import { Box } from "@mui/material";
import { useState } from "react";
import UserSidebar from "./components/UserSidebar";
import UserList from "./components/UserList";
import AlertList from "./components/AlertList";
import BuildingList from "./components/BuildingList";
import RoleList from "../roles/components/RoleList";


const renderContent = (
  activeMenu: string,
  onUpdateUsersCount: (count: number) => void,
  onUpdateRolesCount: (count: number) => void,
  onUpdateBuildingsCount: (count: number) => void,
) => {
  switch (activeMenu) {
    case "users":
      return <UserList onUpdateCount={onUpdateUsersCount} />;
    case "roles":
      return <RoleList onUpdateCount={onUpdateRolesCount} />;
    case "alerts":
      return <AlertList />;
    case "buildings":
      return <BuildingList onUpdateCount={onUpdateBuildingsCount} />;
    default:
      return <UserList onUpdateCount={onUpdateUsersCount} />;
  }
};

const UserManagement = () => {
  const [activeMenu, setActiveMenu] = useState("users");
  const [usersCount, setUsersCount] = useState(0);
  const [rolesCount, setRolesCount] = useState(0);
  const [buildingsCount, setBuildingsCount] = useState(0);

  return (
    <Box
      sx={{
        display: 'flex',
        paddingX: 3,
        paddingY: 4,
        gap: 3,
        flex: 1,
        overflow: 'hidden',
      }}
    >
      {/* Left Sidebar */}
      <Box
        sx={{
          width: 260,
          flexShrink: 0,
        }}
      >
        <UserSidebar
          activeMenu={activeMenu}
          onMenuClick={setActiveMenu}
          usersCount={usersCount}
          rolesCount={rolesCount}
          buildingsCount={buildingsCount}
        />
      </Box>

      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "rgba(255,255,255,0.12)",
            borderRadius: "3px",
          },
        }}
      >
        {renderContent(activeMenu, setUsersCount, setRolesCount, setBuildingsCount)}
      </Box>
    </Box>
  );
};

export default UserManagement;
