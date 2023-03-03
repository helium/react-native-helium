import { useCallback, useEffect, useMemo, useState } from 'react'
import { Buffer } from 'buffer'
import Address from '@helium/address'
import {
  Connection,
  PublicKey,
  VersionedTransaction,
  AccountInfo,
  Cluster,
} from '@solana/web3.js'
import { SolanaStatus, useSolanaStatus, useSolanaVars } from './solanaSentinel'
import * as Currency from '@helium/currency-utils'
import {
  Asset,
  heliumAddressToSolPublicKey,
  HNT_MINT,
  IOT_MINT,
  MOBILE_MINT,
  searchAssets,
  SearchAssetsOpts,
  sendAndConfirmWithRetry,
} from '@helium/spl-utils'
import * as Hotspot from '@helium/hotspot-utils'
import { init as initHsd, subDaoKey } from '@helium/helium-sub-daos-sdk'
import { init as initDc } from '@helium/data-credits-sdk'
import {
  AccountLayout,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  entityCreatorKey,
  init,
  iotInfoKey,
  makerKey,
  mobileInfoKey,
  rewardableEntityConfigKey,
} from '@helium/helium-entity-manager-sdk'
import { getBalance } from '@helium/currency-utils'
import axios from 'axios'
import { AnchorProvider, Wallet, Program, BN } from '@coral-xyz/anchor'
import { HeliumEntityManager } from '@helium/idls/lib/types/helium_entity_manager'
import { HeliumSubDaos } from '@helium/idls/lib/types/helium_sub_daos'
import { DataCredits } from '@helium/idls/lib/types/data_credits'
import { daoKey } from '@helium/helium-sub-daos-sdk'
import { cellToLatLng } from 'h3-js'

type Account = AccountInfo<string[]>
export type HotspotMeta = {
  isFullHotspot: boolean
  location?: string
  numLocationAsserts: number
  lat?: number
  lng?: number
}

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

  const connection = useMemo(() => new Connection(rpcEndpoint), [rpcEndpoint])
  const [dcProgram, setDcProgram] = useState<Program<DataCredits>>()
  const [hemProgram, setHemProgram] = useState<Program<HeliumEntityManager>>()
  const [hsdProgram, setHsdProgram] = useState<Program<HeliumSubDaos>>()

  const wallet = useMemo(
    () => heliumWallet && heliumAddressToSolPublicKey(heliumWallet),
    [heliumWallet]
  )

  const provider = useMemo(() => {
    // TODO: Is this right?
    const anchorWallet = {
      get publicKey() {
        return wallet
      },
    } as Wallet

    return new AnchorProvider(connection, anchorWallet, {
      preflightCommitment: 'confirmed',
    })
  }, [connection, wallet])

  useEffect(() => {
    if (!provider) return

    init(provider).then(setHemProgram)
    initHsd(provider).then(setHsdProgram)
    initDc(provider).then(setDcProgram)
  }, [provider])

  const getHntBalance = useCallback(async () => {
    if (!vars?.hnt.mint)
      throw Error('HNT mint not found for ' + propsCluster.toString())
    if (!wallet) return

    return Currency.getBalance({
      pubKey: wallet,
      connection,
      mint: new PublicKey(vars.hnt.mint),
    })
  }, [propsCluster, connection, vars?.hnt.mint, wallet])

  const getDcBalance = useCallback(async () => {
    if (!vars?.dc.mint)
      throw Error('DC mint not found for ' + propsCluster.toString())
    if (!wallet) return

    return Currency.getBalance({
      pubKey: wallet,
      connection,
      mint: new PublicKey(vars.dc.mint),
    })
  }, [propsCluster, connection, vars?.dc.mint, wallet])

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
    async ({ txns }: { txns: Buffer[] }) => {
      const results = [] as string[]
      for (const txn of txns) {
        results.push(await submitSolana({ txn }))
      }
      return results
    },
    [submitSolana]
  )

  const getOraclePriceFromSolana = useCallback(
    async ({
      tokenType,
    }: {
      tokenType: 'HNT'
    }): Promise<Currency.PriceData | undefined> =>
      Currency.getOraclePrice({ tokenType, cluster: propsCluster, connection }),
    [propsCluster, connection]
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
          apiUrl: rpcEndpoint,
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
    [rpcEndpoint, connection, vars, wallet]
  )

  const getHotspotDetails = async ({
    address,
    type = 'MOBILE',
  }: {
    address: string
    type?: 'MOBILE' | 'IOT'
  }): Promise<HotspotMeta | undefined> => {
    if (!hemProgram) return

    const mint = type === 'IOT' ? IOT_MINT : MOBILE_MINT
    const subDao = subDaoKey(mint)[0]

    const configKey = rewardableEntityConfigKey(subDao, type)

    const entityConfig =
      await hemProgram.account.rewardableEntityConfigV0.fetchNullable(
        configKey[0]
      )
    if (!entityConfig) return

    if (type === 'IOT') {
      const [info] = iotInfoKey(configKey[0], address)
      return hotspotInfoToDetails(
        await hemProgram.account.iotHotspotInfoV0.fetch(info)
      )
    }

    const [info] = await mobileInfoKey(configKey[0], address)
    return hotspotInfoToDetails(
      await hemProgram.account.mobileHotspotInfoV0.fetch(info)
    )
  }

  return {
    connection: connection as Connection | undefined,
    createTransferCompressedCollectableTxn,
    estimateMetaTxnFees,
    getHotspotDetails,
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
    hsdProgram,
    dcProgram,
    provider: provider as AnchorProvider | undefined,
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
    lamportsAfter = new BN(account.lamports.toString()).toNumber()
  } else {
    lamportsAfter = lamportsBefore
  }

  const lamportFee = lamportsBefore - lamportsAfter
  let dcFee = 0

  if (dcAccount) {
    const tokenAccount = AccountLayout.decode(
      Buffer.from(dcAccount.data[0], dcAccount.data[1] as BufferEncoding)
    )

    const dcBalance = new BN(tokenAccount.amount.toString())
    dcAfter = dcBalance.toNumber()
    dcFee = dcBefore - dcAfter
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
    result: { value: { accounts: Account[]; logs: string[]; err?: any } }
  }>(apiUrl, body)

  if (response.data.result.value.err) {
    console.error(response.data.result.value.logs.join('\n'))
    throw new Error('Transaction would fail')
  }
  return response.data.result.value.accounts
}

const hotspotInfoToDetails = (value: {
  asset: PublicKey
  bumpSeed: number
  isFullHotspot: boolean
  location: BN | null
  numLocationAsserts: number
}) => {
  const location = value.location?.toString('hex')
  const details = {
    location,
    isFullHotspot: value.isFullHotspot,
    numLocationAsserts: value.numLocationAsserts,
  } as HotspotMeta

  if (location) {
    const [lat, lng] = cellToLatLng(location)
    details.lat = lat
    details.lng = lng
  }

  return details
}

export default useSolana
