import React from 'react'
import { LogBox } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack'
import Home from './Home'
import Mulitply from './Multiply'
import AddGatewayTxn from './AddGatewayTxn/AddGatewayTxn'
import HotspotBLENav from './HotspotBLE/HotspotBLENav'
import {
  HotspotBleProvider,
  OnboardingProvider,
} from '@helium/react-native-sdk'
import AccountNav from './Account/AccountNav'
import '../appDataClient'
import AssertLocation from './AssertLocation/AssertLocation'
import TransferHotspot from './TransferHotspot/TransferHotspot'

const Stack = createNativeStackNavigator()

export type RootStackParamList = {
  Home: undefined
  Multiply: undefined
  HotspotBLE: undefined
  Account: undefined
  AddGatewayTxn: undefined
  AssertLocation: undefined
  TransferHotspot: undefined
}

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function App() {
  LogBox.ignoreLogs([
    'Require cycle', // ignore HeliumJS require cycles
  ])

  return (
    <OnboardingProvider baseUrl="https://onboarding.dewi.org/api/v2">
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
            <Stack.Screen name="AddGatewayTxn" component={AddGatewayTxn} />
            <Stack.Screen name="AssertLocation" component={AssertLocation} />
            <Stack.Screen name="TransferHotspot" component={TransferHotspot} />
          </Stack.Navigator>
        </NavigationContainer>
      </HotspotBleProvider>
    </OnboardingProvider>
  )
}
