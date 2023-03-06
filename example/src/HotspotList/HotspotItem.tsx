import Clipboard from '@react-native-community/clipboard'
import React, { memo } from 'react'
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { useOnboarding } from '@helium/react-native-sdk'
import angryPurpleTiger from 'angry-purple-tiger'

type Props = { address: string }
const HotspotItem = ({ address }: Props) => {
  const { getOnboardingRecord, getHotspotDetails } = useOnboarding()
  return (
    <TouchableOpacity
      onPress={() => {
        console.log({ address })
        Clipboard.setString(address)
        getOnboardingRecord(address).then(console.log)
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
