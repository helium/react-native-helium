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
import {
  AccountLayout,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  entityCreatorKey,
  init,
  makerKey,
} from '@helium/helium-entity-manager-sdk'
import BigNumber from 'bignumber.js'
import { getBalance } from '@helium/currency-utils'
import axios from 'axios'
import { AnchorProvider, Wallet, Program } from '@coral-xyz/anchor'
import { HeliumEntityManager } from '@helium/idls/lib/types/helium_entity_manager'
import { daoKey } from '@helium/helium-sub-daos-sdk'

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
  const [hemProgram, setHemProgram] = useState<Program<HeliumEntityManager>>()

  useEffect(() => {
    if (!heliumWallet) return

    // TODO: Is this right?
    const anchorWallet = {
      get publicKey() {
        return wallet
      },
    } as Wallet

    const provider = new AnchorProvider(connection, anchorWallet, {
      preflightCommitment: 'confirmed',
    })
    init(provider).then(setHemProgram)
  }, [connection, heliumWallet, wallet])

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
    async (
      opts: Omit<SearchAssetsOpts, 'ownerAddress' | 'creatorAddress'> & {
        makerName?: string
      }
    ) => {
      if (!wallet) return

      const searchParams = {
        ownerAddress: wallet.toString(),
        ...opts,
      } as SearchAssetsOpts

      if (vars?.hnt.mint) {
        const hnt = new PublicKey(vars.hnt.mint)
        const key = entityCreatorKey(daoKey(hnt)[0])[0].toString()
        searchParams.creatorAddress = key.toString()
      }

      if (opts.makerName && hemProgram) {
        // TODO: Verify this works
        const maker = makerKey(opts.makerName)[0]
        const makerAcc = await hemProgram.account.makerV0.fetch(
          maker.toString()
        )
        searchParams.collection = makerAcc.collection.toString()
      }

      return searchAssets(METAPLEX_URL, searchParams)
    },
    [hemProgram, vars?.hnt.mint, wallet]
  )

  const simulateTxn = useCallback(
    async (buff: Buffer, { maker }: { maker: PublicKey }) => {
      if (!wallet || !vars?.hnt.mint || !vars?.dc.mint || !hemProgram) return

      const ownerATA = await getAssociatedTokenAddress(
        new PublicKey(vars.dc.mint),
        wallet
      )

      const makerATA = await getAssociatedTokenAddress(
        new PublicKey(vars.dc.mint),
        maker
      )

      const { makerAccount, ownerAccount, makerDcAccount, ownerDcAccount } =
        await fetchSimulatedTxn({
          apiUrl: clusterApiUrl(cluster),
          maker: maker.toString(),
          owner: wallet.toString(),
          ownerDcAccount: ownerATA.toString(),
          makerDcAccount: makerATA.toString(),
          txnBuff: buff,
        })
      const balances = await estimateBalanceChanges({
        connection,
        owner: {
          key: wallet,
          account: ownerAccount,
          dcAccount: ownerDcAccount,
        },
        maker: { key: maker, account: makerAccount, dcAccount: makerDcAccount },
        dcMint: new PublicKey(vars.dc.mint),
      })
      return balances
    },
    [cluster, connection, hemProgram, vars, wallet]
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

const getBalances = async ({
  dcAccount,
  account,
}: {
  dcAccount: any
  account: any
}) => {
  const balances = { sol: 0, dc: 0 }

  try {
    if (dcAccount) {
      const tokenAccount = AccountLayout.decode(
        Buffer.from(dcAccount.data[0], dcAccount.data[1])
      )

      const dcBalance = BigNumber(tokenAccount.amount.toString())
      balances.dc = dcBalance.toNumber()
    }

    if (account) {
      const lamportsBalance = BigNumber(account.lamports.toString()).toNumber()
      balances.sol = lamportsBalance / LAMPORTS_PER_SOL
    }
  } catch (error) {
    // Decoding of token account failed, not a token account
  }
  return balances
}

const estimateBalanceChanges = async ({
  connection,
  owner,
  maker,
  dcMint,
}: {
  owner: { key: PublicKey; account: any; dcAccount: any }
  maker: { key: PublicKey; account: any; dcAccount: any }
  connection: Connection
  dcMint: PublicKey
}) => {
  const balances = {
    maker: {
      before: {
        sol: 0,
        dc: 0,
      },
      after: {
        sol: 0,
        dc: 0,
      },
    },
    owner: {
      before: {
        sol: 0,
        dc: 0,
      },
      after: {
        sol: 0,
        dc: 0,
      },
    },
  }

  balances.maker.before.sol =
    (await connection.getBalance(maker.key)) / LAMPORTS_PER_SOL
  balances.maker.before.dc = Number(
    await getBalance({
      pubKey: maker.key,
      mint: dcMint,
      connection,
    })
  )

  balances.owner.before.sol =
    (await connection.getBalance(owner.key)) / LAMPORTS_PER_SOL
  balances.owner.before.dc = Number(
    await getBalance({
      pubKey: owner.key,
      mint: dcMint,
      connection,
    })
  )

  balances.maker.after = await getBalances(maker)
  balances.owner.after = await getBalances(owner)

  return balances
}

const fetchSimulatedTxn = async ({
  apiUrl,
  maker,
  owner,
  txnBuff,
  makerDcAccount,
  ownerDcAccount,
}: {
  apiUrl: string
  maker: string
  owner: string
  txnBuff: Buffer
  makerDcAccount: string
  ownerDcAccount: string
}) => {
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
          addresses: [maker, owner, makerDcAccount, ownerDcAccount],
        },
      },
    ],
  }
  const response = await axios.post<{ result: { value: { accounts: any[] } } }>(
    apiUrl,
    body
  )
  const accounts = response.data.result.value.accounts

  return {
    makerAccount: accounts[0],
    ownerAccount: accounts[1],
    makerDcAccount: accounts[2],
    ownerDcAccount: accounts[3],
  }
}

export default useSolana
