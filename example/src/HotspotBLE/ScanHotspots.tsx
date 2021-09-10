import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Device, useHotspotBle } from '@helium/react-native-sdk'
import {
  request,
  check,
  PERMISSIONS,
  RESULTS,
  PermissionStatus,
} from 'react-native-permissions'
import { useNavigation } from '@react-navigation/native'
import type { HotspotBleNavProp } from './HotspotBLENav'

const ScanHotspots = () => {
  const { startScan, stopScan, connect, scannedDevices } = useHotspotBle()
  const [scanning, setScanning] = useState(false)
  const [canScan, setCanScan] = useState<boolean | undefined>(undefined)
  const navigation = useNavigation<HotspotBleNavProp>()

  const showError = (error: any) => {
    console.log(error)
    Alert.alert(error.toString())
  }

  const updateCanScan = useCallback((result: PermissionStatus) => {
    switch (result) {
      case RESULTS.UNAVAILABLE:
      case RESULTS.BLOCKED:
      case RESULTS.DENIED:
      case RESULTS.LIMITED:
        setCanScan(false)
        break
      case RESULTS.GRANTED:
        setCanScan(true)
        break
    }
  }, [])

  useEffect(() => {
    if (Platform.OS === 'ios') {
      setCanScan(true)
      return
    }

    check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION)
      .then(updateCanScan)
      .catch(showError)
  }, [updateCanScan])

  useEffect(() => {
    if (canScan !== false) return

    request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION)
      .then(updateCanScan)
      .catch(showError)
  }, [canScan, updateCanScan])

  const handleScanPress = useCallback(() => {
    const shouldScan = !scanning
    setScanning(shouldScan)

    if (shouldScan) {
      startScan((error) => {
        if (error) {
          showError(error)
        }
      })
    } else {
      stopScan()
    }
  }, [scanning, startScan, stopScan])

  const navNext = useCallback(
    () => navigation.push('HotspotSettings'),
    [navigation]
  )

  const connectDevice = useCallback(
    (d: Device) => async () => {
      try {
        await connect(d)
        if (scanning) {
          stopScan()
          setScanning(false)
        }
        navNext()
      } catch (e) {
        console.log(e)
      }
    },
    [connect, navNext, scanning, stopScan]
  )

  const renderItem = React.useCallback(
    ({ item: device }: { index: number; item: Device }) => {
      return (
        <TouchableOpacity
          onPress={connectDevice(device)}
          style={styles.listItemContainer}
        >
          <Text>{device.name}</Text>
        </TouchableOpacity>
      )
    },
    [connectDevice]
  )

  const keyExtractor = React.useCallback(({ id }: Device) => id, [])

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        contentContainerStyle={styles.container}
        data={scannedDevices}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
      />
      {canScan && (
        <Button
          title={scanning ? 'Stop Scan' : 'Start Scan'}
          onPress={handleScanPress}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listItemContainer: {
    height: 60,
    padding: 16,
    backgroundColor: 'white',
    justifyContent: 'center',
    borderBottomColor: 'lightgray',
    borderBottomWidth: 1,
  },
})

export default ScanHotspots
