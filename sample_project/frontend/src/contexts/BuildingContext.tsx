import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Building as BuildingType } from '@/services/urban/building.service';
import type { Floor } from '@/services/urban/floor.service';
import { floorService } from '@/services/urban/floor.service';
import type { IDevice, IDeviceResponse } from '@/services/building-device/device.model';
import deviceService from '@/services/building-device/device.service';

interface BuildingContextType {
  currentBuilding: BuildingType | null;
  currentFloor: Floor | null;
  floorDevices: IDevice[];
  allBuildingDevices: IDevice[];
  floorMap: Map<number, { name: string; floorNumber: number }>;
  selectedDevice: IDevice | null;
  selected3DFloor: string | null;
  activeTypeFilters: string[];

  setCurrentBuilding: (building: BuildingType | null) => void;
  setCurrentFloor: (floor: Floor | null) => void;
  setFloorDevices: (devices: IDevice[] | ((prev: IDevice[]) => IDevice[])) => void;
  setSelectedDevice: (device: IDevice | null) => void;
  setSelected3DFloor: (floorName: string | null) => void;
  setAllBuildingDevices: (devices: IDevice[] | ((prev: IDevice[]) => IDevice[])) => void;
  setActiveTypeFilters: (filters: string[] | ((prev: string[]) => string[])) => void;

  handleBuildingSelect: (building: BuildingType) => void;
  handleFloorSelect: (floor: Floor, devices: IDevice[], buildingId: number) => void;
  handleDeviceSelect: (device: IDevice) => void;
}

const BuildingContext = createContext<BuildingContextType | undefined>(undefined);

export const BuildingProvider = ({ children }: { children: ReactNode }) => {
  const [currentBuilding, setCurrentBuilding] = useState<BuildingType | null>(null);
  const [currentFloor, setCurrentFloor] = useState<Floor | null>(null);
  const [floorDevices, setFloorDevices] = useState<IDevice[]>([]);
  
  const [allBuildingDevices, setAllBuildingDevices] = useState<IDevice[]>([]);
  const [floorMap, setFloorMap] = useState<Map<number, { name: string; floorNumber: number }>>(new Map());
  
  const [selectedDevice, setSelectedDevice] = useState<IDevice | null>(null);
  const [selected3DFloor, setSelected3DFloor] = useState<string | null>(null);
  const [activeTypeFilters, setActiveTypeFilters] = useState<string[]>([]);

  const handleBuildingSelect = useCallback((building: BuildingType) => {
    setCurrentBuilding(building);
    setCurrentFloor(null);
    setFloorDevices([]);
    setSelectedDevice(null);
    setSelected3DFloor(null);
  }, []);

  const handleFloorSelect = useCallback((floor: Floor, devices: IDevice[], _buildingId: number) => {
    setCurrentFloor(floor);
    setFloorDevices(devices);
    setSelectedDevice(null);
    setSelected3DFloor(floor.name); // Sync to 3D view
  }, []);

  const handleDeviceSelect = useCallback((device: IDevice) => {
    setSelectedDevice(device);
  }, []);

  useEffect(() => {
    if (!currentBuilding) {
      setAllBuildingDevices([]);
      setFloorMap(new Map());
      return;
    }

    const loadBuildingData = async () => {
      try {
        const floors = await floorService.getFloors(currentBuilding.id);
        const fMap = new Map<number, { name: string; floorNumber: number }>();
        (Array.isArray(floors) ? floors : []).forEach((f: Floor) => {
          fMap.set(f.id, { name: f.name, floorNumber: f.floorNumber ?? 0 });
        });
        setFloorMap(fMap);

        const result: IDeviceResponse = await deviceService.getDevices({
          buildingId: currentBuilding.id,
          take: 500,
        });
        setAllBuildingDevices(result?.items || []);
      } catch (err) {
        console.error('Failed to load building devices:', err);
      }
    };

    loadBuildingData();
  }, [currentBuilding]);

  return (
    <BuildingContext.Provider
      value={{
        currentBuilding,
        currentFloor,
        floorDevices,
        allBuildingDevices,
        floorMap,
        selectedDevice,
        selected3DFloor,
        activeTypeFilters,
        setCurrentBuilding,
        setCurrentFloor,
        setFloorDevices,
        setSelectedDevice,
        setSelected3DFloor,
        setAllBuildingDevices,
        setActiveTypeFilters,
        handleBuildingSelect,
        handleFloorSelect,
        handleDeviceSelect,
      }}
    >
      {children}
    </BuildingContext.Provider>
  );
};

export const useBuilding = () => {
  const context = useContext(BuildingContext);
  if (!context) {
    throw new Error('useBuilding must be used within BuildingProvider');
  }
  return context;
};
