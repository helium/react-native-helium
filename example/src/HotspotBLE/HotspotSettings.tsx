import React, { useEffect } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useHotspotBle } from 'react-native-helium'
import { useNavigation } from '@react-navigation/native'
import type { HotspotBleNavProp } from './HotspotBLENav'

const HotspotSettings = () => {
  const navigation = useNavigation<HotspotBleNavProp>()

  const { isConnected, discoverAllServicesAndCharacteristics } = useHotspotBle()

  useEffect(() => {
    isConnected().then((connected) => {
      if (connected) discoverAllServicesAndCharacteristics()
    })
  }, [discoverAllServicesAndCharacteristics, isConnected])

  const renderItem = React.useCallback(
    ({
      item: { title, handler },
    }: {
      index: number
      item: { title: string; handler: () => void }
    }) => {
      return (
        <TouchableOpacity onPress={handler} style={styles.listItemContainer}>
          <Text>{title}</Text>
        </TouchableOpacity>
      )
    },
    []
  )

  const keyExtractor = React.useCallback(
    ({ title }: { title: string }) => title,
    []
  )

  const data = React.useMemo(
    () => [
      {
        title: 'Wi-Fi Settings',
        handler: () => navigation.push('WifiSettings'),
      },
    ],
    [navigation]
  )

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        contentContainerStyle={styles.container}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
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
})

export default HotspotSettings
