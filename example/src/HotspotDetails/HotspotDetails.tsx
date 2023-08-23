import React, { memo, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Input from '../Input'
import animalName from 'angry-purple-tiger'
import Address from '@helium/address'
import { HotspotMeta, useOnboarding, useSolana } from '@helium/react-native-sdk'
import { PublicKey } from '@solana/web3.js'
import Clipboard from '@react-native-clipboard/clipboard'

const HotspotDetails = () => {
  const [hotspotAddress, setHotspotAddress] = useState('')
  const [name, setName] = useState(' ')
  const [assetId, setAssetId] = useState<PublicKey>()
  const [iot, setIot] = useState<HotspotMeta>()
  const [mobile, setMobile] = useState<HotspotMeta>()
  const { getKeyToAsset } = useOnboarding()
  const { getHotspotDetails } = useSolana()

  useEffect(() => {
    if (!Address.isValid(hotspotAddress)) {
      setName(' ')
      setAssetId(undefined)
      setIot(undefined)
      setMobile(undefined)
    } else {
      setName(animalName(hotspotAddress))
      getKeyToAsset(hotspotAddress).then(setAssetId)
      getHotspotDetails({ address: hotspotAddress, type: 'IOT' }).then(setIot)
      getHotspotDetails({ address: hotspotAddress, type: 'MOBILE' }).then(
        setMobile
      )
    }
  }, [getHotspotDetails, getKeyToAsset, hotspotAddress])

  return (
    <View style={styles.container}>
      <Input
        title="Hotspot Address"
        style={styles.innerContainer}
        inputProps={{
          onChangeText: setHotspotAddress,
          value: hotspotAddress,
          placeholder: 'Enter Hotspot Address',
          style: styles.input,
        }}
      />
      <TouchableOpacity
        style={styles.selectable}
        onPress={() => Clipboard.setString(name)}
      >
        <Text style={styles.animal}>{name}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.selectable}
        onPress={() => Clipboard.setString(assetId?.toBase58() || '')}
      >
        <Text>{`Asset Id: ${assetId?.toBase58()}`}</Text>
      </TouchableOpacity>
      <View style={styles.container}>
        <Text>{`Is IOT Onboarded: ${!!iot}`}</Text>
        {Object.keys(iot || {}).map((key) => (
          <TouchableOpacity
            key={key}
            //  @ts-ignore
            onPress={() => Clipboard.setString(iot[key])}
          >
            {/* @ts-ignore */}
            <Text>{`${String(key)}: ${String(iot[key])}`}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.container}>
        <Text>{`Is Mobile Onboarded: ${!!mobile}`}</Text>
        {Object.keys(mobile || {}).map((key) => (
          <TouchableOpacity
            key={key}
            //  @ts-ignore
            onPress={() => Clipboard.setString(mobile[key])}
          >
            {/* @ts-ignore */}
            <Text>{`${String(key)}: ${String(mobile[key])}`}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  animal: { textAlign: 'center', marginVertical: 8 },
  container: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  inline: { flexDirection: 'row' },
  innerContainer: { marginTop: 16 },
  input: {
    borderRadius: 12,
    fontSize: 10,
    paddingVertical: 16,
    paddingLeft: 4,
    backgroundColor: 'white',
    marginTop: 4,
  },
  selectable: { padding: 8 },
})
export default memo(HotspotDetails)
