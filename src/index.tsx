import { NativeModules } from 'react-native';

type HeliumType = {
  multiply(a: number, b: number): Promise<number>;
};

const { Helium } = NativeModules;

export default Helium as HeliumType;
