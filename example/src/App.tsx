import React from 'react'
import { LogBox } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack'
import Home from './Home'
import Mulitply from './Multiply'
import HotspotBLENav from './HotspotBLE/HotspotBLENav'
import { HotspotBleProvider } from 'react-native-helium'
import AccountNav from './Account/AccountNav'
import '../appDataClient'

const Stack = createNativeStackNavigator()

export type RootStackParamList = {
  Home: undefined
  Multiply: undefined
  HotspotBLE: undefined
  Account: undefined
}

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function App() {
  LogBox.ignoreLogs([
    'Require cycle', // ignore HeliumJS require cycles
  ])

  return (
    <HotspotBleProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={({ route }) => ({
            presentation: 'modal',
            headerShown: route.name === 'Home',
          })}
        >
          <Stack.Screen name="Home" component={Home} />
          <Stack.Screen name="Multiply" component={Mulitply} />
          <Stack.Screen name="HotspotBLE" component={HotspotBLENav} />
          <Stack.Screen name="Account" component={AccountNav} />
        </Stack.Navigator>
      </NavigationContainer>
    </HotspotBleProvider>
  )
}
