import { useNavigation } from '@react-navigation/core'
import React, { useCallback, useEffect, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import type { AccountNavProp } from './AccountNav'
import { getAddressStr, signOut } from './secureAccount'
import { Account } from '@helium/react-native-sdk'

const AccountHome = () => {
  const [address, setAddress] = useState<string>()
  const navigation = useNavigation<AccountNavProp>()

  useEffect(() => {
    return navigation.addListener('focus', async () => {
      getAddressStr().then(setAddress)
    })
  }, [navigation])

  const handleCreate = useCallback(
    () => navigation.push('AccountCreate'),
    [navigation]
  )

  const handleImport = useCallback(
    () => navigation.push('AccountImport'),
    [navigation]
  )

  const handleSignout = useCallback(() => {
    signOut()
    setAddress('')
  }, [])

  return (
    <View>
      <View style={styles.info}>
        <Text style={styles.address}>Helium Address:</Text>
        <Text style={styles.address} selectable>
          {address}
        </Text>
        {address && (
          <>
            <Text style={[styles.address, styles.marginTop]}>Sol Address:</Text>
            <Text style={styles.address} selectable>
              {Account.heliumAddressToSolAddress(address)}
            </Text>
          </>
        )}
      </View>
      {!!address && <Button title="Sign Out" onPress={handleSignout} />}
      {!address && <Button title="Create Account" onPress={handleCreate} />}
      {!address && <Button title="Import Account" onPress={handleImport} />}
    </View>
  )
}
const styles = StyleSheet.create({
  info: {
    margin: 32,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'white',
    minHeight: 40,
  },
  address: { fontSize: 17 },
  marginTop: { marginTop: 16 },
})

export default AccountHome
