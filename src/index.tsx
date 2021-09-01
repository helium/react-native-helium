import { NativeModules } from 'react-native';

type HeliumType = {
  multiply(a: number, b: number): Promise<number>;
};

const { Helium } = NativeModules;

const helium = Helium as HeliumType;

export default {
  ...helium,
  multiplyJS(a: number, b: number) {
    return Promise.resolve(a * b);
  },
};
