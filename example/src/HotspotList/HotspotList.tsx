import React, { memo, useCallback, useEffect, useState } from 'react'
import { FlatList, StyleSheet } from 'react-native'
import { useSolana } from '@helium/react-native-sdk'
import { getAddressStr } from '../Account/secureAccount'
import { Asset, heliumAddressToSolAddress } from '@helium/spl-utils'
import Config from 'react-native-config'
import HotspotItem from './HotspotItem'

const HotspotList = () => {
  const { getHotspots: getSolHotspots } = useSolana()
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

  const renderItem = useCallback(({ item }: { item: Asset }) => {
    return <HotspotItem item={item} />
  }, [])

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
