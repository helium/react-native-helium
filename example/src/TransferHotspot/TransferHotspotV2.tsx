import React, { memo, useEffect } from 'react'
import { Text, View } from 'react-native'
import { useOnboarding } from '@helium/react-native-sdk'
import { getAddressStr } from '../Account/secureAccount'

type Props = {}
const TransferHotspotV2 = ({}: Props) => {
  const { createTransferTransaction } = useOnboarding()
  useEffect(() => {
    const goGoGadget = async () => {
      const address = await getAddressStr()
      createTransferTransaction({
        userAddress: address,
        hotspotAddress: '',
        newOwnerAddress: '',
      })
    }
    goGoGadget()
  }, [createTransferTransaction])

  return (
    <View>
      <Text>{'title'}</Text>
    </View>
  )
}

export default memo(TransferHotspotV2)
