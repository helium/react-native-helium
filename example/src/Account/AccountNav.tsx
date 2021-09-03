import * as React from 'react'
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack'
import AccountHome from './AccountHome'
import AccountCreate from './AccountCreate'
import AccountImport from './AccountImport'

const Stack = createNativeStackNavigator()

export type AccountStackParamList = {
  AccountHome: undefined
  AccountCreate: undefined
  AccountImport: undefined
}

export type AccountNavProp = NativeStackNavigationProp<AccountStackParamList>

export default function AccountNav() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AccountHome"
        component={AccountHome}
        options={{ title: 'Account' }}
      />
      <Stack.Screen
        name="AccountCreate"
        component={AccountCreate}
        options={{ title: 'Create' }}
      />
      <Stack.Screen
        name="AccountImport"
        component={AccountImport}
        options={{ title: 'Import' }}
      />
    </Stack.Navigator>
  )
}
