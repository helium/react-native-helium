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
    async () => connection.getBalance(wallet),
    [connection, wallet]
  )

  const getSolHotspotInfo = useCallback(
    async ({
      hotspotAddress,
      type,
    }: {
      hotspotAddress: string
      type: HotspotType
    }) => {
      const mint = type === 'mobile' ? vars?.mobile.mint : vars?.iot.mint
      if (!mint || !hemProgram) {
        return
      }

      return Hotspot.getSolHotspotInfo({
        mint,
        hotspotAddress,
        program: hemProgram,
        symbol: type === 'iot' ? 'IOT' : 'MOBILE',
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
    async ({
      tokenType,
    }: {
      tokenType: 'HNT'
    }): Promise<Currency.PriceData | undefined> =>
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

  const getHotspots = useCallback(async () => {
    // TODO: Add paging
    return Hotspot.getHotspots({
      url: METAPLEX_URL,
      wallet: wallet.toString(),
      hntMint: vars?.hnt.mint || '',
    })
  }, [vars?.hnt.mint, wallet])

  return {
    connection,
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
