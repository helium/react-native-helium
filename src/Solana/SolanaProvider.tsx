import React, { createContext, ReactNode, useContext } from 'react'
import { CompressedNFT, SolHotspot } from './solanaTypes'
import useSolana from './useSolana'
import * as web3 from '@solana/web3.js'
import HeliumSolana from './HeliumSolana'
import { TokenType } from './solanaSentinel'

const initialState = {
  heliumSolana: new HeliumSolana('devnet'),
  createTransferCompressedCollectableTxn: async (_opts: {
    collectable: CompressedNFT
    newOwnerHeliumAddress: string
  }) =>
    new Promise<web3.VersionedTransaction | undefined>((resolve) =>
      resolve(undefined)
    ),
  getHeliumBalance: (_opts: { mint: string }) =>
    new Promise<number | undefined>((resolve) => resolve(undefined)),
  getHotspots: (_opts: { oldestCollectable?: string }) =>
    new Promise<CompressedNFT[]>((resolve) => resolve([])),
  getOraclePriceFromSolana: (_opts: { tokenType: 'HNT' }) =>
    new Promise<number>((resolve) => resolve(0)),
  getSolBalance: () => new Promise<number>((resolve) => resolve(0)),
  getSolHotspotInfo: (_opts: { iotMint: string; hotspotAddress: string }) =>
    new Promise<SolHotspot | null>((resolve) => resolve(null)),
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

export interface SolanaManager {
  heliumSolana: HeliumSolana
  createTransferCompressedCollectableTxn: ({
    collectable,
    newOwnerHeliumAddress,
  }: {
    collectable: CompressedNFT
    newOwnerHeliumAddress: string
  }) => Promise<web3.VersionedTransaction | undefined>
  getHeliumBalance: ({ mint }: { mint: string }) => Promise<number | undefined>
  getHotspots: ({
    oldestCollectable,
  }: {
    oldestCollectable?: string
  }) => Promise<CompressedNFT[]>
  getOraclePriceFromSolana: ({
    tokenType,
  }: {
    tokenType: 'HNT'
  }) => Promise<number>
  getSolBalance: () => Promise<number>
  getSolHotspotInfo: ({
    iotMint,
    hotspotAddress,
  }: {
    iotMint: string
    hotspotAddress: string
  }) => Promise<SolHotspot | null>
  status: {
    inProgress: boolean
    isHelium: boolean
    isSolana: boolean
  }
  submitSolana: ({ txn }: { txn: Buffer }) => Promise<string>
  submitAllSolana: ({ txns }: { txns: Buffer[] }) => Promise<string[]>
  vars:
    | Record<
        TokenType,
        {
          metadata_url: string
          mint: string
        }
      >
    | undefined
}
