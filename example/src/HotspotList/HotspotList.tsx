import React, { memo, useCallback, useEffect, useState } from 'react'
import {
  Text,
  FlatList,
  StyleSheet,
  View,
  TouchableOpacity,
} from 'react-native'
import { useOnboarding, useSolana } from '@helium/react-native-sdk'
import { getAddressStr } from '../Account/secureAccount'
import animalName from 'angry-purple-tiger'
import { Asset, heliumAddressToSolAddress } from '@helium/spl-utils'
import Clipboard from '@react-native-community/clipboard'
import Config from 'react-native-config'

const HotspotList = () => {
  const { getHotspots: getSolHotspots } = useSolana()
  const { getOnboardingRecord } = useOnboarding()
  const [hotspots, setHotspots] = useState<Asset[]>([])

  const fetchHotspots = useCallback(async () => {
    const heliumAddress = await getAddressStr()
    const solHotspots = await getSolHotspots({
      ownerAddress: heliumAddressToSolAddress(heliumAddress),
      makerName: Config.ONBOARDING_MAKER_NAME,
    })
    setHotspots(solHotspots || [])
  }, [getSolHotspots])

  useEffect(() => {
    fetchHotspots()
  }, [fetchHotspots])

  const renderItem = useCallback(
    ({ item }: { item: Asset }) => {
      const address = item.content.json_uri.split('/').slice(-1)[0]
      return (
        <TouchableOpacity
          onPress={() => {
            Clipboard.setString(address)
            getOnboardingRecord(address).then(console.log)
          }}
        >
          <View style={styles.listItem}>
            <Text>{animalName(address)}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit selectable>
              {address}
            </Text>
          </View>
        </TouchableOpacity>
      )
    },
    [getOnboardingRecord]
  )

  const keyExtractor = useCallback((item: Asset) => {
    return item.content.json_uri
  }, [])

  return (
    <FlatList
      data={hotspots}
      renderItem={renderItem}
      style={styles.container}
      keyExtractor={keyExtractor}
    />
  )
}

export default memo(HotspotList)

const styles = StyleSheet.create({
  listItem: { paddingTop: 24, paddingHorizontal: 24 },
  container: { marginTop: 48 },
})
