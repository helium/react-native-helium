import { Address, Keypair, Mnemonic } from '@helium/crypto-react-native'

interface SodiumKeyPair {
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
  const { keypair: keypairRaw, address } = await Keypair.fromMnemonic(mnemonic)
  return { keypairRaw, address, mnemonic }
}

export const getAddress = async (
  addressB58: string
): Promise<Address | undefined> => Address.fromB58(addressB58)

export const getMnemonic = async (words: string[]) => new Mnemonic(words)

export const getKeypair = async (keypairRaw: SodiumKeyPair) =>
  new Keypair(keypairRaw)
