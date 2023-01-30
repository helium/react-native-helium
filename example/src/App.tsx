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
import CreateRandomHotspot from './CreateRandomHotspot/CreateRandomHotspot'
import Config from 'react-native-config'
import OraclePrice from './OraclePrice/OraclePrice'
import * as web3 from '@solana/web3.js'
import { getAddressStr } from './Account/secureAccount'
import { heliumAddressToSolPublicKey } from '@helium/spl-utils'

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
}

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function App() {
  const [address, setAddress] = useState('')
  const [pubKey, setPubKey] = useState(web3.PublicKey.default)
  LogBox.ignoreLogs([
    'Require cycle', // ignore HeliumJS require cycles
  ])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const nextAddr = await getAddressStr()
        if (nextAddr === address) return

        setAddress(nextAddr)
        setPubKey(heliumAddressToSolPublicKey(nextAddr))
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [address])

  return (
    <SolanaProvider cluster="devnet" pubKey={pubKey}>
      <OnboardingProvider
        baseUrl={
          Config.ONBOARDING_BASE_URL || 'https://onboarding.dewi.org/api/v3'
        }
      >
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
                component={CreateRandomHotspot}
              />
              <Stack.Screen name="AssertLocation" component={AssertLocation} />
              <Stack.Screen
                name="TransferHotspot"
                component={TransferHotspot}
              />
              <Stack.Screen name="OraclePrice" component={OraclePrice} />
            </Stack.Navigator>
          </NavigationContainer>
        </HotspotBleProvider>
      </OnboardingProvider>
    </SolanaProvider>
  )
}
