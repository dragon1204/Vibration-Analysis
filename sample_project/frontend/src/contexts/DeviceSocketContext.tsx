import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useBuilding } from '@/contexts/BuildingContext';
import { useDeviceSocket } from '@/hooks/use-device-socket';

interface DeviceUpdate {
  id: string;
  buildingId?: number;
  attributes: Record<string, any>;
  timestamp?: string;
}

interface DeviceSocketContextType {
  connected: boolean;
  lastUpdate: DeviceUpdate | null;
  /** Map of deviceId → latest attributes (accumulated from WS events) */
  deviceAttributes: Record<string, Record<string, any>>;
}

const DeviceSocketContext = createContext<DeviceSocketContextType>({
  connected: false,
  lastUpdate: null,
  deviceAttributes: {},
});

export const DeviceSocketProvider = ({ children }: { children: ReactNode }) => {
  const { currentBuilding } = useBuilding();
  const [deviceAttributes, setDeviceAttributes] = useState<Record<string, Record<string, any>>>({});

  const { connected, lastUpdate } = useDeviceSocket({
    buildingId: currentBuilding?.id,
    onDeviceUpdate: (update) => {
      setDeviceAttributes((prev) => ({
        ...prev,
        [update.id]: {
          ...(prev[update.id] || {}),
          ...update.attributes,
        },
      }));
    },
  });

  // Reset when building changes
  useEffect(() => {
    setDeviceAttributes({});
  }, [currentBuilding?.id]);

  return (
    <DeviceSocketContext.Provider value={{ connected, lastUpdate, deviceAttributes }}>
      {children}
    </DeviceSocketContext.Provider>
  );
};

/**
 * Hook to access real-time device data from WebSocket.
 *
 * Returns:
 * - `connected`: whether the WebSocket is connected
 * - `lastUpdate`: the most recent device update event
 * - `deviceAttributes`: accumulated device attributes map (deviceId → attrs)
 *
 * Use `deviceAttributes[deviceId]` to get real-time attributes for a specific device.
 * These are merged with any REST API data for the latest state.
 */
export const useDeviceSocketContext = () => useContext(DeviceSocketContext);
