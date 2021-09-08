import * as SecureStore from 'expo-secure-store'
import { Account, Mnemonic } from 'react-native-helium'

const stringKeys = ['mnemonic', 'keypair', 'address'] as const
type StringKey = typeof stringKeys[number]

export const setSecureItem = async (key: StringKey, val: string | boolean) =>
  SecureStore.setItemAsync(key, String(val))

export const getSecureItem = (key: StringKey) => SecureStore.getItemAsync(key)

export const deleteSecureItem = async (key: StringKey) =>
  SecureStore.deleteItemAsync(key)

export const signOut = async () =>
  Promise.all(stringKeys.map((key) => deleteSecureItem(key)))

export const makeKeypair = async (
  givenMnemonic: Mnemonic | Array<string> | null = null
) => {
  const { keypairRaw, address, mnemonic } = await Account.createKeypair(
    givenMnemonic
  )
  await Promise.all([
    setSecureItem('mnemonic', JSON.stringify(mnemonic.words)),
    setSecureItem('keypair', JSON.stringify(keypairRaw)),
    setSecureItem('address', address.b58),
  ])
}

export const getAddress = async () => {
  const addressB58 = await getSecureItem('address')
  if (!addressB58) return

  return Account.getAddress(addressB58)
}

export const getKeypair = async () => {
  const keypairStr = await getSecureItem('keypair')
  if (!keypairStr) return

  if (keypairStr) {
    return JSON.parse(keypairStr)
  }
}

export const getAddressStr = async () => {
  const addy = await getAddress()
  return addy?.b58
}

export const getMnemonic = async (): Promise<Mnemonic | undefined> => {
  const wordsStr = await getSecureItem('mnemonic')
  if (!wordsStr) return

  const words = JSON.parse(wordsStr)
  return Account.getMnemonic(words)
}
