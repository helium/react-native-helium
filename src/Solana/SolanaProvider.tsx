import React, { createContext, ReactNode, useContext } from 'react'
import useSolana from './useSolana'
import * as web3 from '@solana/web3.js'
import { Asset, SolHotspot } from '@helium/hotspot-utils'
import { HotspotType } from '@helium/onboarding'

const initialState = {
  createTransferCompressedCollectableTxn: async (_opts: {
    collectable: Asset
    newOwnerHeliumAddress: string
  }) =>
    new Promise<web3.VersionedTransaction | undefined>((resolve) =>
      resolve(undefined)
    ),
  getHeliumBalance: (_opts: { mint: string }) =>
    new Promise<number>((resolve) => resolve(0)),
  getHotspots: (_opts: { oldestCollectable?: string }) =>
    new Promise<Asset[]>((resolve) => resolve([])),
  getOraclePriceFromSolana: (_opts: { tokenType: 'HNT' }) =>
    new Promise<number>((resolve) => resolve(0)),
  getSolBalance: () => new Promise<number>((resolve) => resolve(0)),
  getSolHotspotInfo: (_opts: { hotspotAddress: string; symbol: HotspotType }) =>
    new Promise<SolHotspot | undefined>((resolve) => resolve(undefined)),
  status: {
    inProgress: false,
    isHelium: false,
    isSolana: false,
  },
  submitSolana: (_opts: { txn: Buffer }) =>
    new Promise<string>((resolve) => resolve('')),
  submitAllSolana: (_opts: { txns: Buffer[] }) =>
    new Promise<string[]>((resolve) => resolve([])),
  vars: undefined,
}
const SolanaContext = createContext<ReturnType<typeof useSolana>>(initialState)
const { Provider } = SolanaContext

const SolanaProvider = ({
  children,
  pubKey,
  cluster,
}: {
  children: ReactNode
  cluster?: 'devnet' | 'testnet' | 'mainnet-beta'
  pubKey: web3.PublicKey
}) => {
  return <Provider value={useSolana({ cluster, pubKey })}>{children}</Provider>
}

export const useSolanaContext = (): SolanaManager => useContext(SolanaContext)

export default SolanaProvider

export type SolanaManager = ReturnType<typeof useSolana>
