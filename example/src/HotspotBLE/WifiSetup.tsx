import { RouteProp, useRoute } from '@react-navigation/native'
import React, { useCallback, useState } from 'react'
import { TextInput, View, Text, StyleSheet, Button } from 'react-native'
import type { HotspotBLEStackParamList } from './HotspotBLENav'
import { BleError, useHotspotBle } from '@helium/react-native-sdk'

type Route = RouteProp<HotspotBLEStackParamList, 'WifiSetup'>
const WifiSetup = () => {
  const {
    params: { network },
  } = useRoute<Route>()
  const [secureTextEntry, setSecureTextEntry] = useState(true)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [password, setPassword] = useState('')
  const { setWifi } = useHotspotBle()

  const toggleSecureEntry = useCallback(() => {
    setSecureTextEntry(!secureTextEntry)
  }, [secureTextEntry])

  const handleSetWifi = useCallback(async () => {
    setLoading(true)
    try {
      const nextStatus = await setWifi(network, password)
      setStatus(nextStatus)
    } catch (e) {
      if (typeof e === 'string') {
        setStatus(e)
      } else {
        setStatus((e as BleError).toString())
      }
    }
    setLoading(false)
  }, [network, password, setWifi])

  return (
    <View style={styles.container}>
      <Text style={styles.networkText}>{network}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry={secureTextEntry}
          placeholder="Password"
          style={styles.passwordInput}
        />
        <Button
          title={secureTextEntry ? 'Show' : 'Hide'}
          onPress={toggleSecureEntry}
        />
      </View>
      <View style={styles.buttonContainer}>
        <Button onPress={handleSetWifi} disabled={loading} title={'Set Wifi'} />
      </View>
      <Text style={styles.status}>{loading ? 'loading...' : status}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingEnd: 8,
  },
  buttonContainer: { padding: 32 },
  networkText: {
    fontSize: 19,
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 32,
  },
  passwordInput: {
    borderRadius: 12,
    flex: 1,
    fontSize: 19,
    padding: 16,
    backgroundColor: 'white',
  },
  status: {
    textAlign: 'center',
    fontSize: 17,
  },
})

export default WifiSetup
