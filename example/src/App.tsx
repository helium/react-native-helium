import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import Home from './Home';
import Mulitply from './Multiply';
import HotspotBLENav from './HotspotBLE/HotspotBLENav';

const Stack = createNativeStackNavigator();

export type RootStackParamList = {
  Home: undefined;
  Multiply: undefined;
  HotspotBLE: undefined;
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Multiply" component={Mulitply} />
        <Stack.Screen name="HotspotBLE" component={HotspotBLENav} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
