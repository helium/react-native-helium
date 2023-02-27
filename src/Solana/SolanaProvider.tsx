import React, { createContext, ReactNode, useContext } from 'react'
import useSolana from './useSolana'
import * as web3 from '@solana/web3.js'
import { PriceData } from '@helium/currency-utils'
import { Asset, SearchAssetsOpts } from '@helium/spl-utils'
import { SolanaStatus } from './solanaSentinel'

const initialState = {
  connection: undefined,
  createTransferCompressedCollectableTxn: async (_opts: {
    collectable: Asset
    newOwnerSolanaOrHeliumAddresss: string
  }) =>
    new Promise<web3.VersionedTransaction | undefined>((resolve) =>
      resolve(undefined)
    ),
  getDcBalance: () => new Promise<bigint>((resolve) => resolve(0n)),
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
  estimateMetaTxnFees: (
    _buff: Buffer,
    _opts: {
      maker: web3.PublicKey
    }
  ) =>
    new Promise<
      | {
          makerFees: {
            lamports: number
            dc: number
          }
          ownerFees: {
            lamports: number
            dc: number
          }
          isFree: boolean
        }
      | undefined
    >((resolve) => resolve(undefined)),
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
  hemProgram: undefined,
  dcProgram: undefined,
  hsdProgram: undefined,
  provider: undefined,
}
const SolanaContext = createContext<ReturnType<typeof useSolana>>(initialState)
const { Provider } = SolanaContext

const SolanaProvider = ({
  children,
  heliumWallet,
  cluster,
  solanaStatusOverride,
  rpcEndpoint,
}: {
  children: ReactNode
  cluster?: 'devnet' | 'testnet' | 'mainnet-beta'
  heliumWallet?: string
  solanaStatusOverride?: SolanaStatus
  rpcEndpoint: string
}) => {
  return (
    <Provider
      value={useSolana({
        cluster,
        heliumWallet,
        solanaStatusOverride,
        rpcEndpoint,
      })}
    >
      {children}
    </Provider>
  )
}

export const useSolanaContext = (): SolanaManager => useContext(SolanaContext)

export default SolanaProvider

export type SolanaManager = ReturnType<typeof useSolana>
