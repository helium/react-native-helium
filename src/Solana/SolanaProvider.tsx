import React, { createContext, ReactNode, useContext } from 'react'
import { CompressedNFT, SolanaManager, SolHotspot } from './solanaTypes'
import useSolana from './useSolana'
import * as web3 from '@solana/web3.js'
import HeliumSolana from './HeliumSolana'

const initialState = {
  heliumSolana: new HeliumSolana('devnet'),
  createTransferCompressedCollectableTxn: async (_opts: {
    collectable: CompressedNFT
    ownerHeliumAddress: string
    newOwnerHeliumAddress: string
  }) =>
    new Promise<web3.VersionedTransaction | undefined>((resolve) =>
      resolve(undefined)
    ),
  getHeliumBalance: (_opts: { heliumAddress: string; mint: string }) =>
    new Promise<number | undefined>((resolve) => resolve(undefined)),
  getHotspots: (_opts: { heliumAddress: string; oldestCollectable?: string }) =>
    new Promise<CompressedNFT[]>((resolve) => resolve([])),
  getOraclePriceFromSolana: (_opts: { tokenType: 'HNT' }) =>
    new Promise<number>((resolve) => resolve(0)),
  getSolBalance: (_opts: { heliumAddress: string }) =>
    new Promise<number>((resolve) => resolve(0)),
  getSolHotspotInfo: (_opts: {
    iotMint: string
    hotspotAddress: string
    heliumAddress: string
  }) => new Promise<SolHotspot | null>((resolve) => resolve(null)),
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
  cluster,
}: {
  children: ReactNode
  cluster?: 'devnet' | 'testnet' | 'mainnet-beta'
}) => {
  return <Provider value={useSolana({ cluster })}>{children}</Provider>
}

export const useSolanaContext = (): SolanaManager => useContext(SolanaContext)

export default SolanaProvider
