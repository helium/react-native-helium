import * as React from 'react'
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack'
import ScanHotspots from './ScanHotspots'
import HotspotSettings from './HotspotSettings'
import WifiSettings from './WifiSettings'
import AddGatewayBle from './AddGatewayBle'
import WifiSetup from './WifiSetup'

const Stack = createNativeStackNavigator()

export type HotspotBLEStackParamList = {
  ScanHotspots: undefined
  HotspotSettings: undefined
  WifiSettings: undefined
  WifiSetup: { network: string }
  AddGatewayBle: undefined
}

export type HotspotBleNavProp =
  NativeStackNavigationProp<HotspotBLEStackParamList>

export default function HotspotBLENav() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ScanHotspots" component={ScanHotspots} />
      <Stack.Screen name="HotspotSettings" component={HotspotSettings} />
      <Stack.Screen name="WifiSettings" component={WifiSettings} />
      <Stack.Screen name="WifiSetup" component={WifiSetup} />
      <Stack.Screen name="AddGatewayBle" component={AddGatewayBle} />
    </Stack.Navigator>
  )
}
