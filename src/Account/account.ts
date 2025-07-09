/**
 * [[include:Account.md]]
 * @packageDocumentation
 * @module Account
 */

import { Keypair, Mnemonic } from '@helium/crypto-react-native'
import Address, { NetTypes } from '@helium/address'
import wordlist from './Wordlists/english.json'
import { shuffle, uniq, take, sampleSize } from 'lodash'
import * as web3 from '@solana/web3.js'

/**
 * A keypair with secret key (sk) and public key (pk) as base64 strings.
 */
export interface SodiumKeyPair {
  sk: string
  pk: string
}

/**
 * Creates a keypair from the provided {@link Mnemonic}, or from a newly
 * generated one. Defaults to a wordCount of 12 and netType of MainNet.
 * @param givenMnemonic list of bip39 words to create the keypair with
 * @param wordCount either 12 or 24 to indicate how many seed words to use
 * @param netType the NetType to use for the keypair (Mainnet / Testnet)
 */
export const createKeypair = async (
  givenMnemonic: Mnemonic | Array<string> | null,
  wordCount: 12 | 24 = 12,
  netType: NetTypes.NetType = NetTypes.MAINNET
) => {
  let mnemonic: Mnemonic
  if (!givenMnemonic) {
    mnemonic = await Mnemonic.create(wordCount)
  } else if ('words' in givenMnemonic) {
    mnemonic = givenMnemonic
  } else {
    mnemonic = new Mnemonic(givenMnemonic)
  }
  const { keypair, address } = await Keypair.fromMnemonic(mnemonic, netType)
  const keypairRaw = keypair as SodiumKeyPair
  return { keypairRaw, address, mnemonic }
}

/**
 * Get an {@link Address} from a b58 string.
 * @param addressB58
 */
export const getAddress = async (addressB58: string): Promise<Address> =>
  Address.fromB58(addressB58)

/**
 * Get a {@link Mnemonic} from a list of bip39 words.
 * @param words
 */
export const getMnemonic = async (words: string[]) => new Mnemonic(words)

/**
 * Get a {@link Keypair} from a {@link SodiumKeyPair}
 * @param keypairRaw
 */
export const getKeypair = (keypairRaw: SodiumKeyPair): Keypair =>
  new Keypair(keypairRaw)

/**
 * Get the list of bip39 words that match a given substring.
 * @param text
 */
export const getMatchingWords = (text: string) =>
  wordlist.filter((word) => word.indexOf(text.toLocaleLowerCase()) === 0)

/**
 * Generate a list of 12 bip39 words, one being the targetWord. You can use this
 * to confirm the user knows their word out of a list or words.
 * @param targetWord
 */
export const generateChallengeWords = (targetWord: string) =>
  shuffle(
    uniq(
      take(
        sampleSize(wordlist, 12).filter((w) => w !== targetWord),
        11
      ).concat(targetWord)
    )
  )

export const heliumAddressToSolPublicKey = (heliumAddress: string) => {
  const heliumPK = Address.fromB58(heliumAddress).publicKey
  return new web3.PublicKey(heliumPK)
}

export const heliumAddressToSolAddress = (heliumAddress: string) => {
  return heliumAddressToSolPublicKey(heliumAddress).toBase58()
}
