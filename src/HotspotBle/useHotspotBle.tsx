import { useEffect, useRef } from 'react';
import { BleManager, Device, LogLevel, BleError } from 'react-native-ble-plx';

enum Service {
  FIRMWARESERVICE_UUID = '0000180a-0000-1000-8000-00805f9b34fb',
  MAIN_UUID = '0fda92b2-44a2-4af2-84f5-fa682baa2b8d',
}

const useHotspotBle = () => {
  const instanceRef = useRef<BleManager | null>(null);

  const getBleManager = () => {
    const instance = instanceRef.current;
    if (instance !== null) {
      return instance;
    }

    console.log('create ble manager');
    const newInstance = new BleManager();
    instanceRef.current = newInstance;

    if (__DEV__) {
      console.log('setting ble log level to verbose');
      instanceRef.current.setLogLevel(LogLevel.Verbose);
    }

    return newInstance;
  };

  useEffect(() => {
    const manager = getBleManager();

    return () => {
      console.log('destroy ble manager');
      manager.destroy();
    };
  }, []);

  const startScan = async (
    callback: (error: BleError | null, device: Device | null) => void
  ) => {
    getBleManager().startDeviceScan(
      [Service.MAIN_UUID],
      { allowDuplicates: false },
      callback
    );
  };

  const stopScan = () => getBleManager().stopDeviceScan();

  return { startScan, stopScan };
};

export default useHotspotBle;
