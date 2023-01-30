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
import * as Currency from '@helium/currency-utils'
import {
  Asset,
  heliumAddressToSolPublicKey,
  sendAndConfirmWithRetry,
} from '@helium/spl-utils'
import * as Hotspot from '@helium/hotspot-utils'

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

  useEffect(() => {
    if (pubKey.equals(wallet) && cluster === propsCluster) return

    const update = async () => {
      setCluster(propsCluster)
      setWallet(pubKey)
      const nextConnection = new Connection(clusterApiUrl(cluster))
      setConnection(nextConnection)
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
      Currency.getOraclePrice({ tokenType, cluster, connection }),
    [cluster, connection]
  )

  const createTransferCompressedCollectableTxn = useCallback(
    async ({
      collectable,
      newOwnerHeliumAddress,
    }: {
      collectable: Asset
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

    //TODO:
    //   const creator = entityCreatorKey(new PublicKey(hntMint))[0]
    // return searchAssets(METAPLEX_URL, wallet, creator.toString(), {})
    return [] as Asset[]
  }, [])

  return {
    connection,
    createTransferCompressedCollectableTxn,
    getHeliumBalance,
    getHotspots,
    getOraclePriceFromSolana,
    getSolBalance,
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
