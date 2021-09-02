import { NativeModules } from 'react-native';
import useHotspotBle from './HotspotBle/useHotspotBle';
export { Device, BleError } from 'react-native-ble-plx';

type HeliumNativeType = {
  multiply(a: number, b: number): Promise<number>;
};

const { Helium } = NativeModules;

const heliumNativeModules = Helium as HeliumNativeType;

const multiplyJS = (a: number, b: number) => {
  return Promise.resolve(a * b);
};

const { multiply } = heliumNativeModules;

export { useHotspotBle, multiplyJS, multiply };
