import { useCallback, useEffect, useState } from 'react'
import { Buffer } from 'buffer'
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  Cluster,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import { SolanaStatus, useSolanaStatus, useSolanaVars } from './solanaSentinel'
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
import BigNumber from 'bignumber.js'
import { getBalance } from '@helium/currency-utils'
import axios from 'axios'

// TODO: Get urls for each cluster
const METAPLEX_URL = 'https://rpc-devnet.aws.metaplex.com/'

export const createConnection = (cluster: Cluster) =>
  new Connection(clusterApiUrl(cluster))

const useSolana = ({
  cluster: propsCluster = 'devnet',
  heliumWallet,
  solanaStatusOverride,
}: {
  cluster?: Cluster
  heliumWallet?: string
  solanaStatusOverride?: SolanaStatus
}) => {
  const { isHelium, isSolana, inProgress } =
    useSolanaStatus(solanaStatusOverride)

  const { data: vars } = useSolanaVars(propsCluster)

  const [cluster, setCluster] = useState(propsCluster)
  const [wallet, setWallet] = useState<PublicKey>()
  const [connection, setConnection] = useState(createConnection(propsCluster))

  useEffect(() => {
    try {
      if (!heliumWallet) return
      const nextPubKey = heliumAddressToSolPublicKey(heliumWallet)
      if (wallet && nextPubKey.equals(wallet) && cluster === propsCluster)
        return

      const update = async () => {
        setCluster(propsCluster)
        setWallet(nextPubKey)
        const nextConnection = new Connection(clusterApiUrl(cluster))
        setConnection(nextConnection)
      }
      update()
    } catch {}
  }, [cluster, heliumWallet, propsCluster, wallet])

  const getHntBalance = useCallback(async () => {
    if (!vars?.hnt.mint)
      throw Error('HNT mint not found for ' + cluster.toString())
    if (!wallet) return

    return Currency.getBalance({
      pubKey: wallet,
      connection,
      mint: new PublicKey(vars?.hnt.mint),
    })
  }, [cluster, connection, vars?.hnt.mint, wallet])

  const getBalances = useCallback(async () => {
    if (!wallet) return
    const tokenAccounts = await connection.getTokenAccountsByOwner(wallet, {
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

  const getSolBalance = useCallback(async () => {
    if (!wallet) return 0
    return connection.getBalance(wallet)
  }, [connection, wallet])

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
      if (!wallet) return
      const recipient = heliumAddressToSolPublicKey(newOwnerHeliumAddress)
      return Hotspot.createTransferCompressedCollectableTxn({
        collectable,
        owner: wallet,
        recipient,
        connection,
        url: METAPLEX_URL,
      })
    },
    [connection, wallet]
  )

  const getHotspots = useCallback(
    async (opts: Omit<SearchAssetsOpts, 'ownerAddress' | 'creatorAddress'>) => {
      if (!wallet) return
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

  const simulateTxn = useCallback(
    async (buff: Buffer, { maker }: { maker: PublicKey }) => {
      if (!wallet || !vars?.hnt.mint) return

      const { makerAccount, ownerAccount } = await fetchSimulatedTxn({
        apiUrl: clusterApiUrl(cluster),
        maker: maker.toString(),
        owner: wallet.toString(),
        txnBuff: buff,
      })
      const balances = estimateBalanceChanges({
        connection,
        owner: { key: wallet, account: ownerAccount },
        maker: { key: maker, account: makerAccount },
        hntMint: new PublicKey(vars.hnt.mint),
      })
      console.log(balances)
      return balances
    },
    [cluster, connection, vars, wallet]
  )

  return {
    connection,
    createTransferCompressedCollectableTxn,
    getHntBalance,
    getBalances,
    getHotspots,
    getOraclePriceFromSolana,
    getSolBalance,
    simulateTxn,
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

const SOL_NATIVE_MINT = PublicKey.default.toString()
const getBalances = async ({
  account,
  key,
  hntMint,
}: {
  account: any
  key: PublicKey
  hntMint: PublicKey
}) => {
  console.log({ account })
  const balances = { sol: 0, hnt: 0 }

  const isToken = account.owner === TOKEN_PROGRAM_ID.toString()
  const isNativeSol = account.owner === SOL_NATIVE_MINT
  if (isToken || isNativeSol) {
    try {
      if (isToken) {
        // parse token, should be hnt
        const tokenAccount = AccountLayout.decode(
          Buffer.from(account.data[0], account.data[1])
        )
        if (!new PublicKey(tokenAccount.owner).equals(key)) {
          // This isn't a token account we care about
          return balances
        }

        // token mint, should be hnt
        const tokenMint = new PublicKey(tokenAccount.mint)
        if (!tokenMint.equals(hntMint)) {
          throw new Error('wut!!!!!!!!!')
        }
        const hntBalance = BigNumber(tokenAccount.amount.toString())
        balances.hnt = hntBalance.toNumber()
      } else {
        // Parse changes in native SOL balances
        const lamportsBalance = BigNumber(
          account.lamports.toString()
        ).toNumber()
        balances.sol = lamportsBalance / LAMPORTS_PER_SOL
      }
    } catch (error) {
      // Decoding of token account failed, not a token account
    }
  }
  return balances
}

const estimateBalanceChanges = async ({
  connection,
  owner,
  maker,
  hntMint,
}: {
  owner: { key: PublicKey; account: any }
  maker: { key: PublicKey; account: any }
  connection: Connection
  hntMint: PublicKey
}) => {
  const balances = {
    maker: {
      before: {
        sol: 0,
        hnt: 0,
      },
      after: {
        sol: 0,
        hnt: 0,
      },
    },
    owner: {
      before: {
        sol: 0,
        hnt: 0,
      },
      after: {
        sol: 0,
        hnt: 0,
      },
    },
  }

  balances.maker.before.sol = await connection.getBalance(maker.key)
  balances.maker.before.hnt = Number(
    await getBalance({
      pubKey: maker.key,
      mint: hntMint,
      connection,
    })
  )

  balances.owner.before.sol = await connection.getBalance(owner.key)
  balances.owner.before.hnt = Number(
    await getBalance({
      pubKey: owner.key,
      mint: hntMint,
      connection,
    })
  )

  balances.maker.after = await getBalances({ ...maker, hntMint })
  balances.owner.after = await getBalances({ ...owner, hntMint })
}

const fetchSimulatedTxn = async ({
  apiUrl,
  maker,
  owner,
  txnBuff,
}: {
  apiUrl: string
  maker: string
  owner: string
  txnBuff: Buffer
}) => {
  console.log({ apiUrl })
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'simulateTransaction',
    params: [
      txnBuff.toString('base64'),
      {
        encoding: 'base64',
        commitment: 'recent',
        sigVerify: false,
        accounts: {
          encoding: 'jsonParsed',
          addresses: [maker, owner],
        },
      },
    ],
  }
  console.log({ body })
  const response = await axios.post<{ result: { value: { accounts: any[] } } }>(
    apiUrl,
    body
  )
  console.log(response.data.result.value)
  // TODO: No idea if this is right
  const accounts = response.data.result.value.accounts

  return {
    makerAccount: accounts[0],
    ownerAccount: accounts[1],
  }
}
