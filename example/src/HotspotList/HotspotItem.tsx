import Clipboard from '@react-native-clipboard/clipboard'
import React, { memo } from 'react'
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { useOnboarding, useSolana } from '@helium/react-native-sdk'

type Props = { address: string; name: string }
const HotspotItem = ({ address, name }: Props) => {
  const { getOnboardingRecord } = useOnboarding()
  const { getHotspotDetails } = useSolana()
  return (
    <TouchableOpacity
      onPress={() => {
        console.log(`Getting details for\n${name}\n${address}`)
        Clipboard.setString(address)

        getOnboardingRecord(address).then((r) =>
          console.log(`\nOnboarding Record -\n${JSON.stringify(r, null, 2)}`)
        )

        getHotspotDetails({ address, type: 'IOT' }).then((d) =>
          console.log(`\nIOT details -\n${JSON.stringify(d, null, 2)}`)
        )
        getHotspotDetails({ address, type: 'MOBILE' }).then((d) =>
          console.log(`\nMOBILE details -\n${JSON.stringify(d, null, 2)}`)
        )
      }}
    >
      <View style={styles.listItem}>
        <Text>{name}</Text>
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
