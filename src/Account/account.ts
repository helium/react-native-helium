import { Address, Keypair, Mnemonic } from '@helium/crypto-react-native'
import wordlist from './Wordlists/english.json'
import 'react-native-get-random-values'

export interface SodiumKeyPair {
  sk: string
  pk: string
}

export const createKeypair = async (
  givenMnemonic: Mnemonic | Array<string> | null = null
) => {
  let mnemonic: Mnemonic
  if (!givenMnemonic) {
    mnemonic = await Mnemonic.create()
  } else if ('words' in givenMnemonic) {
    mnemonic = givenMnemonic
  } else {
    mnemonic = new Mnemonic(givenMnemonic)
  }
  const { keypair, address } = await Keypair.fromMnemonic(mnemonic)
  const keypairRaw = keypair as SodiumKeyPair
  return { keypairRaw, address, mnemonic }
}

export const getAddress = async (
  addressB58: string
): Promise<Address | undefined> => Address.fromB58(addressB58)

export const getMnemonic = async (words: string[]) => new Mnemonic(words)

export const getKeypair = (keypairRaw: SodiumKeyPair) => new Keypair(keypairRaw)

export const getMatchingWords = (text: string) =>
  wordlist.filter((word) => word.indexOf(text.toLocaleLowerCase()) === 0)
