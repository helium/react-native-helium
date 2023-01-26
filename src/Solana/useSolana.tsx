import { useCallback, useRef } from 'react'
import { Buffer } from 'buffer'
import * as web3 from '@solana/web3.js'
import { CompressedNFT } from './solanaTypes'
import { useSolanaStatus, useSolanaVars } from './solanaSentinel'
import HeliumSolana from './HeliumSolana'

const useSolana = ({
  cluster = 'devnet',
  pubKey,
}: {
  cluster?: 'mainnet-beta' | 'devnet' | 'testnet'
  pubKey: web3.PublicKey
}) => {
  const { isHelium, isSolana, inProgress } = useSolanaStatus()
  const { data: vars } = useSolanaVars(cluster)
  const heliumSolana = useRef(new HeliumSolana(cluster))

  const getHeliumBalance = useCallback(
    async ({ mint }: { mint: string }) => {
      return heliumSolana.current.getHeliumBalance({
        pubKey,
        mint,
      })
    },
    [pubKey]
  )

  const getSolBalance = useCallback(async () => {
    return heliumSolana.current.getSolBalance({
      pubKey,
    })
  }, [pubKey])

  const getSolHotspotInfo = useCallback(
    async ({
      iotMint,
      hotspotAddress,
    }: {
      iotMint: string
      hotspotAddress: string
    }) => {
      return heliumSolana.current.getSolHotspotInfo({
        iotMint,
        hotspotAddress,
        pubKey,
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
      newOwnerHeliumAddress,
    }: {
      collectable: CompressedNFT
      newOwnerHeliumAddress: string
    }): Promise<web3.VersionedTransaction | undefined> => {
      const owner = pubKey
      const recipient = HeliumSolana.heliumAddressToSolPublicKey(
        newOwnerHeliumAddress
      )
      return heliumSolana.current.createTransferCompressedCollectableTxn({
        collectable,
        owner,
        recipient,
      })
    },
    [pubKey]
  )

  const getHotspots = useCallback(
    async ({ oldestCollectable }: { oldestCollectable?: string }) => {
      return heliumSolana.current.getHotspots({
        pubKey,
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
