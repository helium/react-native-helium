import { Asset } from '@helium/spl-utils'
import Clipboard from '@react-native-community/clipboard'
import React, { memo } from 'react'
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { useOnboarding, useSolana } from '@helium/react-native-sdk'
import angryPurpleTiger from 'angry-purple-tiger'

type Props = { item: Asset }
const HotspotItem = ({ item }: Props) => {
  const { getOnboardingRecord } = useOnboarding()
  const { getHotspotDetails } = useSolana()
  const address = item.content.json_uri.split('/').slice(-1)[0]
  return (
    <TouchableOpacity
      onPress={() => {
        Clipboard.setString(address)
        getOnboardingRecord(address).then(console.log)
        console.log(JSON.stringify(item, null, 2))
        getHotspotDetails({ address, type: 'IOT' }).then(console.log)
        getHotspotDetails({ address, type: 'MOBILE' }).then(console.log)
      }}
    >
      <View style={styles.listItem}>
        <Text>{angryPurpleTiger(address)}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit selectable>
          {address}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

export default memo(HotspotItem)

const styles = StyleSheet.create({
  listItem: { paddingTop: 24, paddingHorizontal: 24 },
})
