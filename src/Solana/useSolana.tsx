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
  searchAssets,
  SearchAssetsOpts,
  sendAndConfirmWithRetry,
} from '@helium/spl-utils'
import * as Hotspot from '@helium/hotspot-utils'
import { AccountLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { entityCreatorKey } from '@helium/helium-entity-manager-sdk'

// TODO: Get urls for each cluster
const METAPLEX_URL = 'https://rpc-devnet.aws.metaplex.com/'

export const createConnection = (cluster: Cluster) =>
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

  const getHntBalance = useCallback(async () => {
    if (!vars?.hnt.mint)
      throw Error('HNT mint not found for ' + cluster.toString())
    return Currency.getBalance({
      pubKey: wallet,
      connection,
      mint: new PublicKey(vars?.hnt.mint),
    })
  }, [cluster, connection, vars?.hnt.mint, wallet])

  const getBalances = useCallback(async () => {
    const account = new PublicKey(wallet)
    const tokenAccounts = await connection.getTokenAccountsByOwner(account, {
      programId: TOKEN_PROGRAM_ID,
    })

    const vals = {} as Record<string, bigint>
    tokenAccounts.value.forEach((tokenAccount) => {
      const accountData = AccountLayout.decode(tokenAccount.account.data)
      vals[accountData.mint.toBase58()] = accountData.amount
    })

    return {
      hntBalance: vars?.hnt.mint ? vals[vars.hnt.mint] : 0n,
      iotBalance: vars?.iot.mint ? vals[vars.iot.mint] : 0n,
      dcBalance: vars?.dc.mint ? vals[vars.dc.mint] : 0n,
      mobileBalance: vars?.mobile.mint ? vals[vars.mobile.mint] : 0n,
    }
  }, [connection, vars, wallet])

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

  const getHotspots = useCallback(
    async (opts: Omit<SearchAssetsOpts, 'ownerAddress' | 'creatorAddress'>) => {
      // TODO: Test, make sure this is right?
      const creator = entityCreatorKey(new PublicKey(vars?.hnt.mint || ''))[0]
      return searchAssets(METAPLEX_URL, {
        ownerAddress: wallet.toString(),
        creatorAddress: creator.toString(),
        ...opts,
      })
    },
    [vars?.hnt.mint, wallet]
  )

  return {
    connection,
    createTransferCompressedCollectableTxn,
    getHntBalance,
    getBalances,
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
