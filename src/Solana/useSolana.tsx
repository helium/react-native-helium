import { useCallback, useEffect, useMemo, useState } from 'react'
import { Buffer } from 'buffer'
import Address from '@helium/address'
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  Cluster,
  VersionedTransaction,
  AccountInfo,
} from '@solana/web3.js'
import { SolanaStatus, useSolanaStatus, useSolanaVars } from './solanaSentinel'
import * as Currency from '@helium/currency-utils'
import {
  Asset,
  heliumAddressToSolPublicKey,
  HNT_MINT,
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
import { daoKey } from '@helium/helium-sub-daos-sdk'
import { HeliumEntityManager } from '@helium/idls/lib/types/helium_entity_manager'

type Account = AccountInfo<string[]>

const useSolana = ({
  heliumWallet,
  solanaStatusOverride,
  rpcEndpoint,
  cluster: propsCluster = 'devnet',
}: {
  cluster?: Cluster
  heliumWallet?: string
  solanaStatusOverride?: SolanaStatus
  rpcEndpoint: string
}) => {
  const { isHelium, isSolana, inProgress } =
    useSolanaStatus(solanaStatusOverride)

  const { data: vars } = useSolanaVars(propsCluster)

  const [wallet, setWallet] = useState<PublicKey>()
  const [cluster, setCluster] = useState(propsCluster)
  const connection = useMemo(() => new Connection(rpcEndpoint), [rpcEndpoint])
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
      mint: new PublicKey(vars.hnt.mint),
    })
  }, [cluster, connection, vars?.hnt.mint, wallet])

  const getDcBalance = useCallback(async () => {
    if (!vars?.dc.mint)
      throw Error('DC mint not found for ' + cluster.toString())
    if (!wallet) return

    return Currency.getBalance({
      pubKey: wallet,
      connection,
      mint: new PublicKey(vars.dc.mint),
    })
  }, [cluster, connection, vars?.dc.mint, wallet])

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
      newOwnerSolanaOrHeliumAddresss,
    }: {
      collectable: Asset
      newOwnerSolanaOrHeliumAddresss: string
    }): Promise<VersionedTransaction | undefined> => {
      if (!wallet) return
      const recipient = Address.isValid(newOwnerSolanaOrHeliumAddresss)
        ? heliumAddressToSolPublicKey(newOwnerSolanaOrHeliumAddresss)
        : new PublicKey(newOwnerSolanaOrHeliumAddresss)
      return Hotspot.createTransferCompressedCollectableTxn({
        collectable,
        owner: wallet,
        recipient,
        connection,
        url: rpcEndpoint,
      })
    },
    [connection, wallet, rpcEndpoint]
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
        const maker = makerKey(
          daoKey(vars?.hnt.mint ? new PublicKey(vars?.hnt.mint) : HNT_MINT)[0],
          opts.makerName
        )[0]
        const makerAcc = await hemProgram.account.makerV0.fetch(
          maker.toString()
        )
        searchParams.collection = makerAcc.collection.toString()
      }

      return searchAssets(rpcEndpoint, searchParams)
    },
    [hemProgram, vars?.hnt.mint, wallet, rpcEndpoint]
  )

  const estimateMetaTxnFees = useCallback(
    async (buff: Buffer, { maker }: { maker: PublicKey }) => {
      if (!wallet || !vars?.dc.mint) return

      const walletDC = await getAssociatedTokenAddress(
        new PublicKey(vars.dc.mint),
        wallet
      )

      const makerDC = await getAssociatedTokenAddress(
        new PublicKey(vars.dc.mint),
        maker
      )

      const [makerAccount, makerDcAccount, ownerAccount, ownerDcAccount] =
        await fetchSimulatedTxn({
          apiUrl: clusterApiUrl(cluster),
          accountAddresses: [
            maker.toString(),
            makerDC.toString(),
            wallet.toString(),
            walletDC.toString(),
          ],
          txnBuff: buff,
        })

      const fees = await estimateFees({
        connection,
        owner: {
          key: wallet,
          account: ownerAccount,
          dcAccount: ownerDcAccount,
        },
        maker: { key: maker, account: makerAccount, dcAccount: makerDcAccount },
        dcMint: new PublicKey(vars.dc.mint),
      })
      return fees
    },
    [cluster, connection, vars, wallet]
  )

  return {
    connection: connection as Connection | undefined,
    createTransferCompressedCollectableTxn,
    estimateMetaTxnFees,
    getDcBalance,
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
    hemProgram,
  }
}

export const getAccountFees = async ({
  dcAccount,
  account,
  connection,
  key,
  dcMint,
}: {
  key: PublicKey
  dcAccount?: Account
  account?: Account
  connection: Connection
  dcMint: PublicKey
}) => {
  const lamportsBefore = await connection.getBalance(key)
  const dcBefore = Number(
    await getBalance({ pubKey: key, mint: dcMint, connection })
  )

  let lamportsAfter = 0
  let dcAfter = 0

  if (account) {
    lamportsAfter = BigNumber(account.lamports.toString()).toNumber()
  }

  const lamportFee = lamportsBefore - lamportsAfter
  let dcFee = 0

  if (dcAccount) {
    const tokenAccount = AccountLayout.decode(
      Buffer.from(dcAccount.data[0], dcAccount.data[1] as BufferEncoding)
    )

    const dcBalance = BigNumber(tokenAccount.amount.toString())
    dcAfter = dcBalance.toNumber()
    dcFee = dcBefore - dcAfter
    // TODO: will dc show as negative if they don't have enough?
  } else if (lamportFee) {
    // TODO: they have no dc and they are the payer, now what?
    dcFee = 1000000
  }

  return { lamports: lamportFee, dc: dcFee }
}

const estimateFees = async ({
  connection,
  owner,
  maker,
  dcMint,
}: {
  owner: { key: PublicKey; account: Account; dcAccount: Account }
  maker: { key: PublicKey; account: Account; dcAccount: Account }
  connection: Connection
  dcMint: PublicKey
}) => {
  const makerFees = await getAccountFees({ connection, ...maker, dcMint })
  const ownerFees = await getAccountFees({ connection, ...owner, dcMint })

  return {
    makerFees,
    ownerFees,
    isFree: ownerFees.lamports === 0 && ownerFees.dc === 0,
  }
}

export const fetchSimulatedTxn = async ({
  apiUrl,
  txnBuff,
  accountAddresses,
}: {
  apiUrl: string
  txnBuff: Buffer
  accountAddresses: string[]
}): Promise<Array<Account>> => {
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
          addresses: accountAddresses,
        },
      },
    ],
  }
  const response = await axios.post<{
    result: { value: { accounts: Account[] } }
  }>(apiUrl, body)

  return response.data.result.value.accounts
}

export default useSolana
