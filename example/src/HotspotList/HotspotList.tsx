import React, { memo, useCallback, useEffect, useState } from 'react'
import { Text, FlatList, StyleSheet, View } from 'react-native'
import { useSolana } from '@helium/react-native-sdk'
import { getAddress } from '../Account/secureAccount'
import animalName from 'angry-purple-tiger'
import { Asset } from '@helium/spl-utils'

const HotspotList = () => {
  const { getHotspots: getSolHotspots } = useSolana()
  const [hotspots, setHotspots] = useState<Asset[]>([])

  const fetchHotspots = useCallback(async () => {
    const heliumAddress = await getAddress()
    const solHotspots = await getSolHotspots({ heliumAddress })
    setHotspots(solHotspots || [])
  }, [getSolHotspots])

  useEffect(() => {
    fetchHotspots()
  }, [fetchHotspots])

  const renderItem = useCallback(({ item }: { item: Asset }) => {
    const address = item.content.json_uri.split('/').slice(-1)[0]
    return (
      <View style={styles.listItem}>
        <Text>{animalName(address)}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit selectable>
          {address}
        </Text>
      </View>
    )
  }, [])

  const keyExtractor = useCallback((item: Asset) => {
    return item.content.json_uri
  }, [])

  return (
    <FlatList
      data={hotspots}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
    />
  )
}

export default memo(HotspotList)

const styles = StyleSheet.create({
  listItem: { paddingTop: 24, paddingHorizontal: 24 },
})
