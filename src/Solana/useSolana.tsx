import { useCallback, useRef } from 'react'
import { Buffer } from 'buffer'
import * as web3 from '@solana/web3.js'
import { CompressedNFT } from './solanaTypes'
import { useSolanaStatus, useSolanaVars } from './solanaSentinel'
import HeliumSolana from './HeliumSolana'

const useSolana = ({
  cluster = 'devnet',
}: {
  cluster?: 'mainnet-beta' | 'devnet' | 'testnet'
}) => {
  const { isHelium, isSolana, inProgress } = useSolanaStatus()
  const { data: vars } = useSolanaVars(cluster)
  const heliumSolana = useRef(new HeliumSolana(cluster))

  const pubKey = useCallback((heliumAddress: string) => {
    return HeliumSolana.heliumAddressToSolPublicKey(heliumAddress)
  }, [])

  const getHeliumBalance = useCallback(
    async ({
      heliumAddress,
      mint,
    }: {
      heliumAddress: string
      mint: string
    }) => {
      return heliumSolana.current.getHeliumBalance({
        pubKey: pubKey(heliumAddress),
        mint,
      })
    },
    [pubKey]
  )

  const getSolBalance = useCallback(
    async ({ heliumAddress }: { heliumAddress: string }) => {
      return heliumSolana.current.getSolBalance({
        pubKey: pubKey(heliumAddress),
      })
    },
    [pubKey]
  )

  const getSolHotspotInfo = useCallback(
    async ({
      iotMint,
      hotspotAddress,
      heliumAddress,
    }: {
      iotMint: string
      hotspotAddress: string
      heliumAddress: string
    }) => {
      return heliumSolana.current.getSolHotspotInfo({
        iotMint,
        hotspotAddress,
        pubKey: pubKey(heliumAddress),
      })
    },
    [pubKey]
  )

  const submitSolana = useCallback(async ({ txn }: { txn: Buffer }) => {
    return heliumSolana.current.submitSolana({ txn })
  }, [])

  const submitAllSolana = useCallback(
    ({ txns }: { txns: Buffer[] }) =>
      Promise.all(txns.map((txn) => submitSolana({ txn }))),
    [submitSolana]
  )

  const getOraclePriceFromSolana = useCallback(
    async ({ tokenType }: { tokenType: 'HNT' }) => {
      return heliumSolana.current.getOraclePriceFromSolana({ tokenType })
    },
    []
  )

  const createTransferCompressedCollectableTxn = useCallback(
    async ({
      collectable,
      ownerHeliumAddress,
      newOwnerHeliumAddress,
    }: {
      collectable: CompressedNFT
      ownerHeliumAddress: string
      newOwnerHeliumAddress: string
    }): Promise<web3.VersionedTransaction | undefined> => {
      const owner = pubKey(ownerHeliumAddress)
      const recipient = pubKey(newOwnerHeliumAddress)
      return heliumSolana.current.createTransferCompressedCollectableTxn({
        collectable,
        owner,
        recipient,
      })
    },
    [pubKey]
  )

  const getHotspots = useCallback(
    async ({
      heliumAddress,
      oldestCollectable,
    }: {
      heliumAddress: string
      oldestCollectable?: string
    }) => {
      return heliumSolana.current.getHotspots({
        pubKey: pubKey(heliumAddress),
        after: oldestCollectable,
      })
    },
    [pubKey]
  )

  return {
    createTransferCompressedCollectableTxn,
    getHeliumBalance,
    getHotspots,
    getOraclePriceFromSolana,
    getSolBalance,
    getSolHotspotInfo,
    heliumSolana: heliumSolana.current,
    status: {
      inProgress,
      isHelium,
      isSolana,
    },
    submitSolana,
    submitAllSolana,
    vars,
  }
}

export default useSolana
