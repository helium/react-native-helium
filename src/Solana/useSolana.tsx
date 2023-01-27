import { useCallback, useEffect, useState } from 'react'
import { Buffer } from 'buffer'
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  Cluster,
  VersionedTransaction,
} from '@solana/web3.js'
import { useSolanaStatus, useSolanaVars } from './solanaSentinel'
import * as Hotspot from '@helium/hotspot-utils'
import * as Currency from '@helium/currency-utils'
import { Program } from '@project-serum/anchor'
import { HeliumEntityManager } from '@helium/idls/lib/types/helium_entity_manager'
import { getOraclePrice } from '@helium/currency-utils'
import {
  heliumAddressToSolPublicKey,
  sendAndConfirmWithRetry,
} from '@helium/spl-utils'
import { HotspotType } from '@helium/onboarding'

// TODO: Get urls for each cluster
const METAPLEX_URL = 'https://rpc-devnet.aws.metaplex.com/'

const createConnection = (cluster: Cluster) =>
  new Connection(clusterApiUrl(cluster))

const useSolana = ({
  cluster: propsCluster = 'devnet',
  pubKey,
}: {
  cluster?: Cluster
  pubKey: PublicKey
}) => {
  const { isHelium, isSolana, inProgress } = useSolanaStatus()

  // TODO: Verify these update with cluster change
  const { data: vars } = useSolanaVars(propsCluster)

  const [cluster, setCluster] = useState(propsCluster)
  const [wallet, setWallet] = useState(pubKey)
  const [connection, setConnection] = useState(createConnection(propsCluster))
  const [hemProgram, setHemProgram] = useState<Program<HeliumEntityManager>>()

  useEffect(() => {
    if (pubKey.equals(wallet) && cluster === propsCluster) return

    const update = async () => {
      setCluster(propsCluster)
      setWallet(pubKey)
      const nextConnection = new Connection(clusterApiUrl(cluster))
      setConnection(nextConnection)
      const nextHemProgram = await Hotspot.createHeliumEntityManagerProgram({
        publicKey: pubKey,
        connection: nextConnection,
      })
      setHemProgram(nextHemProgram)
    }
    update()
  }, [cluster, propsCluster, pubKey, wallet])

  const getHeliumBalance = useCallback(
    async ({ mint }: { mint: string }) =>
      Currency.getBalance({
        pubKey: wallet,
        connection,
        mint,
      }),
    [connection, wallet]
  )

  const getSolBalance = useCallback(
    async () => Currency.getSolBalance({ connection, pubKey: wallet }),
    [connection, wallet]
  )

  const getSolHotspotInfo = useCallback(
    async ({
      hotspotAddress,
      symbol,
    }: {
      hotspotAddress: string
      symbol: HotspotType
    }) => {
      const mint = symbol === 'MOBILE' ? vars?.mobile.mint : vars?.iot.mint
      if (!mint || !hemProgram) {
        return
      }

      return Hotspot.getSolHotspotInfo({
        mint,
        hotspotAddress,
        program: hemProgram,
        symbol,
      })
    },
    [hemProgram, vars]
  )

  const submitSolana = useCallback(
    async ({ txn }: { txn: Buffer }) => {
      const { txid } = await sendAndConfirmWithRetry(
        connection,
        txn,
        { skipPreflight: true },
        'confirmed'
      )
      return txid
    },
    [connection]
  )

  const submitAllSolana = useCallback(
    ({ txns }: { txns: Buffer[] }) =>
      Promise.all(txns.map((txn) => submitSolana({ txn }))),
    [submitSolana]
  )

  const getOraclePriceFromSolana = useCallback(
    async ({ tokenType }: { tokenType: 'HNT' }) =>
      getOraclePrice({ tokenType, cluster, connection }),
    [cluster, connection]
  )

  const createTransferCompressedCollectableTxn = useCallback(
    async ({
      collectable,
      newOwnerHeliumAddress,
    }: {
      collectable: Hotspot.Asset
      newOwnerHeliumAddress: string
    }): Promise<VersionedTransaction | undefined> => {
      const owner = pubKey
      const recipient = heliumAddressToSolPublicKey(newOwnerHeliumAddress)
      return Hotspot.createTransferCompressedCollectableTxn({
        collectable,
        owner,
        recipient,
        connection,
        url: METAPLEX_URL,
      })
    },
    [connection, pubKey]
  )

  const getHotspots = useCallback(
    async ({ oldestCollectable }: { oldestCollectable?: string }) => {
      return Hotspot.getAssetsByOwner(METAPLEX_URL, wallet.toString(), {
        after: oldestCollectable,
      })
    },
    [wallet]
  )

  return {
    createTransferCompressedCollectableTxn,
    getHeliumBalance,
    getHotspots,
    getOraclePriceFromSolana,
    getSolBalance,
    getSolHotspotInfo,
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
