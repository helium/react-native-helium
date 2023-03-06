import React, { memo, useCallback, useEffect, useState } from 'react'
import { FlatList, StyleSheet } from 'react-native'
import { useOnboarding } from '@helium/react-native-sdk'
import { getAddressStr } from '../Account/secureAccount'
import { Asset } from '@helium/spl-utils'
import HotspotItem from './HotspotItem'

type HeliumHotspot = { address: string }
const getAddress = (item: Asset | HeliumHotspot) => {
  const asset = item as Asset
  if (asset?.content?.json_uri) {
    return asset.content.json_uri.split('/').slice(-1)[0]
  }

  const hotspot = item as HeliumHotspot
  return hotspot.address
}

const HotspotList = () => {
  const { getHotspots } = useOnboarding()
  const [hotspots, setHotspots] = useState<{ address: string }[]>([])

  const fetchHotspots = useCallback(async () => {
    const heliumAddress = await getAddressStr()
    const nextHotspots = await getHotspots({ heliumAddress })
    if (!nextHotspots) return

    setHotspots(
      nextHotspots.map((h) => ({
        address: getAddress(h),
      }))
    )
  }, [getHotspots])

  useEffect(() => {
    fetchHotspots()
  }, [fetchHotspots])

  const renderItem = useCallback(
    ({ item }: { item: Asset | HeliumHotspot }) => {
      return <HotspotItem address={getAddress(item)} />
    },
    []
  )

  const keyExtractor = useCallback((item: Asset | HeliumHotspot) => {
    return getAddress(item)
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
