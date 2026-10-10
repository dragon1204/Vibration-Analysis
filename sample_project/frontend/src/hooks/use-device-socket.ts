import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { API_ENDPOINT } from '@/configs/constant.config';

interface DeviceUpdate {
  id: string;
  buildingId?: number;
  attributes: Record<string, any>;
  timestamp?: string;
}

interface UseDeviceSocketOptions {
  buildingId?: number;
  floorId?: number;
  /** Called when any device in the building receives an attribute update */
  onDeviceUpdate?: (update: DeviceUpdate) => void;
  /** Called when connection status changes */
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Hook that connects to the backend WebSocket server and subscribes
 * to real-time device attribute updates for a specific building/floor.
 *
 * Usage:
 * ```tsx
 * const { connected, lastUpdate } = useDeviceSocket({
 *   buildingId: 1,
 *   floorId: 5,
 *   onDeviceUpdate: (update) => {
 *     // update device state in your component
 *   },
 * });
 * ```
 */
export function useDeviceSocket({
  buildingId,
  floorId,
  onDeviceUpdate,
  onConnectionChange,
}: UseDeviceSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<DeviceUpdate | null>(null);

  // Store callbacks in refs to avoid re-connecting on every render
  const onDeviceUpdateRef = useRef(onDeviceUpdate);
  onDeviceUpdateRef.current = onDeviceUpdate;
  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;

  useEffect(() => {
    if (!buildingId) return;

    // Connect to the NestJS WebSocket server
    const wsUrl = API_ENDPOINT || window.location.origin;
    const socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[WS] Connected: ${socket.id}`);
      setConnected(true);
      onConnectionChangeRef.current?.(true);

      // Join building room
      socket.emit('join:building', { buildingId });

      // Join floor room if specified
      if (floorId) {
        socket.emit('join:floor', { buildingId, floorId });
      }
    });

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
      setConnected(false);
      onConnectionChangeRef.current?.(false);
    });

    // Listen for device attribute updates (building-level)
    socket.on('device:attribute-update', (data: DeviceUpdate) => {
      setLastUpdate(data);
      onDeviceUpdateRef.current?.(data);
    });

    // Listen for floor-level updates
    socket.on('data::attribute', (data: DeviceUpdate) => {
      setLastUpdate(data);
      onDeviceUpdateRef.current?.(data);
    });

    return () => {
      if (buildingId) {
        socket.emit('leave:building', { buildingId });
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [buildingId, floorId]);

  /** Manually emit a custom event to the server */
  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { connected, lastUpdate, emit, socket: socketRef };
}
