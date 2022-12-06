import React, { useEffect, useState } from 'react'
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
  SolanaProvider,
} from '@helium/react-native-sdk'
import AccountNav from './Account/AccountNav'
import '../appDataClient'
import AssertLocation from './AssertLocation/AssertLocation'
import TransferHotspot from './TransferHotspot/TransferHotspot'
import CreateSolanaHotspot from './CreateSolanaHotspot/CreateSolanaHotspot'
import OraclePrice from './OraclePrice/OraclePrice'
import { getAddressStr } from './Account/secureAccount'
import HotspotList from './HotspotList/HotspotList'

const Stack = createNativeStackNavigator()

export type RootStackParamList = {
  Home: undefined
  Multiply: undefined
  HotspotBLE: undefined
  Account: undefined
  CreateRandomHotspot: undefined
  AddGatewayTxn: undefined
  AssertLocation: undefined
  TransferHotspot: undefined
  OraclePrice: undefined
  HotspotList: undefined
}

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function App() {
  const [address, setAddress] = useState('')
  const [heliumWallet, setHeliumWallet] = useState('')
  LogBox.ignoreLogs([
    'Require cycle', // ignore HeliumJS require cycles
  ])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const nextAddr = await getAddressStr()
        if (nextAddr === address) return

        setAddress(nextAddr)
        setHeliumWallet(nextAddr)
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [address])

  return (
    <SolanaProvider
      cluster="devnet"
      heliumWallet={heliumWallet}
      solanaStatusOverride="complete"
    >
      <OnboardingProvider baseUrl="https://onboarding.oracle.test-helium.com/api">
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
              <Stack.Screen
                name="CreateRandomHotspot"
                component={CreateSolanaHotspot}
              />
              <Stack.Screen name="AssertLocation" component={AssertLocation} />
              <Stack.Screen
                name="TransferHotspot"
                component={TransferHotspot}
              />
              <Stack.Screen name="OraclePrice" component={OraclePrice} />
              <Stack.Screen name="HotspotList" component={HotspotList} />
            </Stack.Navigator>
          </NavigationContainer>
        </HotspotBleProvider>
      </OnboardingProvider>
    </SolanaProvider>
  )
}
