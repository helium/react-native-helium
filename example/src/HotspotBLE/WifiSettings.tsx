import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useHotspotBle } from '@helium/react-native-sdk'
import { useNavigation } from '@react-navigation/core'
import type { HotspotBleNavProp } from './HotspotBLENav'

type Section = {
  title: string
  data: string[]
  type: 'configured' | 'available'
}

const WifiSettings = () => {
  const navigation = useNavigation<HotspotBleNavProp>()
  const [networks, setNetworks] = useState<string[]>()
  const [configuredNetworks, setConfiguredNetworks] = useState<string[]>()
  const [connected, setConnected] = useState(false)

  const { isConnected, readWifiNetworks, removeConfiguredWifi } =
    useHotspotBle()

  useEffect(() => {
    isConnected().then(setConnected)
  }, [isConnected])

  useEffect(() => {
    if (!connected) return

    readWifiNetworks(true).then(setConfiguredNetworks)
    readWifiNetworks(false).then(setNetworks)
  }, [connected, readWifiNetworks])

  const handleNetworkSelected = useCallback(
    ({
        network,
        type,
      }: {
        network: string
        type: 'configured' | 'available'
      }) =>
      async () => {
        if (type === 'available') {
          navigation.push('WifiSetup', { network })
        } else {
          Alert.alert('Wifi Setup', `Would you like to remove ${network}?`, [
            {
              text: 'Cancel',
              style: 'default',
            },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                setConfiguredNetworks(
                  configuredNetworks?.filter((n) => n !== network)
                )
                await removeConfiguredWifi(network)
                readWifiNetworks(true).then(setConfiguredNetworks)
                readWifiNetworks(false).then(setNetworks)
              },
            },
          ])
        }
      },
    [configuredNetworks, navigation, readWifiNetworks, removeConfiguredWifi]
  )

  const renderItem = useCallback(
    ({
      item: network,
      section: { type },
    }: {
      index: number
      item: string
      section: Section
    }) => {
      return (
        <TouchableOpacity
          onPress={handleNetworkSelected({ network, type })}
          style={styles.listItemContainer}
        >
          <Text>{network}</Text>
        </TouchableOpacity>
      )
    },
    [handleNetworkSelected]
  )

  const keyExtractor = useCallback((name: string) => name, [])

  const renderSectionHeader = ({
    section: { title },
  }: {
    section: Section
  }) => <Text style={styles.headerText}>{title}</Text>

  const sections = useMemo(
    (): Section[] => [
      {
        data: networks || [],
        title: 'Available Networks',
        type: 'available',
      },
      {
        data: configuredNetworks || [],
        title: 'Configured Networks',
        type: 'configured',
      },
    ],
    [configuredNetworks, networks]
  )

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* @ts-ignore SectionList typing is terrible */}
      <SectionList
        contentContainerStyle={styles.container}
        sections={sections}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        renderSectionHeader={renderSectionHeader}
      />
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
  headerText: { backgroundColor: 'lightgray', color: 'white', padding: 8 },
})

export default WifiSettings
