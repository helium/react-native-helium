import React, { createContext, ReactNode, useContext } from 'react'
import useSolana, { createConnection } from './useSolana'
import * as web3 from '@solana/web3.js'
import { PriceData } from '@helium/currency-utils'
import { Asset, SearchAssetsOpts } from '@helium/spl-utils'

const initialState = {
  connection: createConnection('devnet'),
  createTransferCompressedCollectableTxn: async (_opts: {
    collectable: Asset
    newOwnerHeliumAddress: string
  }) =>
    new Promise<web3.VersionedTransaction | undefined>((resolve) =>
      resolve(undefined)
    ),
  getHntBalance: () => new Promise<bigint>((resolve) => resolve(0n)),
  getBalances: () =>
    new Promise<{
      hntBalance: bigint
      iotBalance: bigint
      mobileBalance: bigint
      dcBalance: bigint
    }>((resolve) =>
      resolve({
        hntBalance: 0n,
        iotBalance: 0n,
        dcBalance: 0n,
        mobileBalance: 0n,
      })
    ),
  getHotspots: (
    _opts: Omit<SearchAssetsOpts, 'ownerAddress' | 'creatorAddress'>
  ) => new Promise<Asset[]>((resolve) => resolve([])),
  getOraclePriceFromSolana: (_opts: { tokenType: 'HNT' }) =>
    new Promise<PriceData | undefined>((resolve) => resolve(undefined)),
  getSolBalance: () => new Promise<number>((resolve) => resolve(0)),
  simulateTxn: (
    _buff: Buffer,
    _opts: {
      maker: web3.PublicKey
    }
  ) => new Promise<any>((resolve) => resolve(undefined)),
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
  heliumWallet,
  cluster,
}: {
  children: ReactNode
  cluster?: 'devnet' | 'testnet' | 'mainnet-beta'
  heliumWallet: string
}) => {
  return (
    <Provider value={useSolana({ cluster, heliumWallet })}>{children}</Provider>
  )
}

export const useSolanaContext = (): SolanaManager => useContext(SolanaContext)

export default SolanaProvider

export type SolanaManager = ReturnType<typeof useSolana>
