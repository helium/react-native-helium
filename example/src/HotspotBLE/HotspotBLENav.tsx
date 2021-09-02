import * as React from 'react'
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack'
import ScanHotspots from './ScanHotspots'

const Stack = createNativeStackNavigator()

export type HotspotBLEStackParamList = {
  Scan: undefined
}

export type RootNavigationProp =
  NativeStackNavigationProp<HotspotBLEStackParamList>

export default function HotspotBLENav() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ScanHotspots" component={ScanHotspots} />
    </Stack.Navigator>
  )
}
