import * as SecureStore from 'expo-secure-store'
import { Account, Mnemonic } from '@helium/react-native-sdk'
import { Keypair } from '@solana/web3.js'
import { Buffer } from 'buffer'

export type SecureAccount = {
  mnemonic: string[]
  keypair: { pk: string; sk: string }
  address: string
}

const stringKeys = ['mnemonic', 'keypair', 'address'] as const
type StringKey = (typeof stringKeys)[number]

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
  if (!addressB58) throw new Error('No user address found')

  return Account.getAddress(addressB58)
}

export const getKeypairRaw = async () => {
  const keypairStr = await getSecureItem('keypair')
  if (!keypairStr) throw new Error('Keypair not found')

  return JSON.parse(keypairStr) as {
    sk: string
    pk: string
  }
}

export const getAddressStr = async () => {
  const addy = await getAddress()
  return addy?.b58
}

export const getMnemonic = async () => {
  const wordsStr = await getSecureItem('mnemonic')
  if (!wordsStr) return

  const words = JSON.parse(wordsStr)
  return Account.getMnemonic(words)
}

export const getSolanaPubKey = async (sk: string) => {
  const secretKey = Uint8Array.from(Buffer.from(sk, 'base64'))
  const kp = Keypair.fromSecretKey(secretKey)
  return kp.publicKey
}
