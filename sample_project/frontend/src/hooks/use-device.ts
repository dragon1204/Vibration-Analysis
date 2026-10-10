import { useState, useEffect, useCallback } from 'react';
import deviceService from '@/services/building-device/device.service';
import type { IDevice, IDeviceQuery, IDeviceResponse } from '@/services/building-device/device.model';

interface UseDevicesReturn {
  devices: IDevice[];
  loading: boolean;
  error: Error | null;
  totalCount: number;
  refetch: () => Promise<void>;
  setQuery: React.Dispatch<React.SetStateAction<IDeviceQuery>>;
  query: IDeviceQuery;
}

export const useDevices = (initialQuery: IDeviceQuery = {}): UseDevicesReturn => {
  const [devices, setDevices] = useState<IDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [query, setQuery] = useState<IDeviceQuery>(initialQuery);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await deviceService.getDevices(query);
      const data = response.data as unknown as IDeviceResponse;
      
      setDevices(data.items || []);
      setTotalCount(data.total || data.totalCount || 0);
    } catch (err) {
      console.error('Error fetching devices:', err);
      setError(err as Error);
      setDevices([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return {
    devices,
    loading,
    error,
    totalCount,
    refetch: fetchDevices,
    setQuery,
    query,
  };
};

interface UseDeviceReturn {
  device: IDevice | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useDevice = (id: number | string | null): UseDeviceReturn => {
  const [device, setDevice] = useState<IDevice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDevice = useCallback(async () => {
    if (!id) {
      setDevice(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await deviceService.getDeviceById(id);
      
      // Response có thể là: { data: IDevice } hoặc IDevice
      setDevice(response.data || response);
    } catch (err) {
      console.error('Error fetching device:', err);
      setError(err as Error);
      setDevice(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDevice();
  }, [fetchDevice]);

  return {
    device,
    loading,
    error,
    refetch: fetchDevice,
  };
};

interface UseMutateDeviceReturn {
  createDevice: (data: Partial<IDevice>) => Promise<IDevice | null>;
  updateDevice: (id: number | string, data: Partial<IDevice>) => Promise<IDevice | null>;
  deleteDevice: (id: number | string) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
}

export const useMutateDevice = (): UseMutateDeviceReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createDevice = async (data: Partial<IDevice>): Promise<IDevice | null> => {
    try {
      setLoading(true);
      setError(null);
      const result = await deviceService.createDevice(data);
      return result;
    } catch (err) {
      console.error('Error creating device:', err);
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateDevice = async (id: number | string, data: Partial<IDevice>): Promise<IDevice | null> => {
    try {
      setLoading(true);
      setError(null);
      const result = await deviceService.updateDevice(id, data);
      return result;
    } catch (err) {
      console.error('Error updating device:', err);
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteDevice = async (id: number | string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      await deviceService.deleteDevice(id);
      return true;
    } catch (err) {
      console.error('Error deleting device:', err);
      setError(err as Error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    createDevice,
    updateDevice,
    deleteDevice,
    loading,
    error,
  };
};