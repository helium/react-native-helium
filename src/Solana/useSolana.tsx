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
import * as Currency from '@helium/currency-utils'
import {
  Asset,
  heliumAddressToSolPublicKey,
  HNT_MINT,
  IOT_MINT,
  MOBILE_MINT,
  getAsset,
  searchAssets,
  SearchAssetsOpts,
  sendAndConfirmWithRetry,
  DC_MINT,
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
  init as initHem,
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

const HOTSPOT_PAGE_LIMIT = 100
const HOTSPOT_CREATOR_ADDRESS = entityCreatorKey(
  daoKey(HNT_MINT)[0]
)[0].toString()

type Account = AccountInfo<string[]>
export type HotspotMeta = {
  isFullHotspot: boolean
  location?: string
  numLocationAsserts: number
  lat?: number
  lng?: number
  owner?: string
  elevation?: number
  gain?: number
}

const useSolana = ({
  heliumWallet,
  rpcEndpoint,
  cluster: propsCluster = 'devnet',
}: {
  cluster?: Cluster
  heliumWallet?: string
  rpcEndpoint: string
}) => {
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

    initHem(provider).then(setHemProgram)
    initHsd(provider).then(setHsdProgram)
    initDc(provider).then(setDcProgram)
  }, [provider])

  const getHntBalance = useCallback(async () => {
    if (!wallet) return

    return Currency.getBalance({
      pubKey: wallet,
      connection,
      mint: new PublicKey(HNT_MINT),
    })
  }, [connection, wallet])

  const getDcBalance = useCallback(async () => {
    if (!wallet) return

    return Currency.getBalance({
      pubKey: wallet,
      connection,
      mint: new PublicKey(DC_MINT),
    })
  }, [connection, wallet])

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
      hntBalance: vals[HNT_MINT.toBase58()],
      iotBalance: vals[IOT_MINT.toBase58()],
      dcBalance: vals[DC_MINT.toBase58()],
      mobileBalance: vals[MOBILE_MINT.toBase58()],
    }
  }, [connection, wallet])

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

      delete opts.makerName
      delete opts.heliumAddress

      const page: number = (opts?.page as number) || 1
      const searchParams = {
        ...opts,
        ownerAddress: wallet.toString(),
        page: page,
        limit: HOTSPOT_PAGE_LIMIT,
        creatorAddress: HOTSPOT_CREATOR_ADDRESS,
      } as SearchAssetsOpts

      if (opts.makerName && hemProgram) {
        const maker = makerKey(daoKey(HNT_MINT)[0], opts.makerName)[0]
        const makerAcc = await hemProgram.account.makerV0.fetch(
          maker.toString()
        )
        searchParams.collection = makerAcc.collection.toString()
      }

      return searchAssets(rpcEndpoint, searchParams)
    },
    [hemProgram, wallet, rpcEndpoint]
  )

  const estimateMetaTxnFees = useCallback(
    async (buff: Buffer, { maker }: { maker: PublicKey }) => {
      if (!wallet) return

      const walletDC = await getAssociatedTokenAddress(
        new PublicKey(DC_MINT),
        wallet
      )

      const makerDC = await getAssociatedTokenAddress(
        new PublicKey(DC_MINT),
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
        dcMint: new PublicKey(DC_MINT),
      })
      return fees
    },
    [rpcEndpoint, connection, wallet]
  )

  const getHotspotDetails = useCallback(
    async ({
      address,
      type = 'MOBILE',
    }: {
      address: string
      type: 'MOBILE' | 'IOT'
    }): Promise<HotspotMeta | undefined> => {
      try {
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
          const iotInfo = await hemProgram.account.iotHotspotInfoV0.fetch(info)
          const asset = await getAsset(rpcEndpoint, iotInfo.asset)
          return hotspotInfoToDetails(iotInfo, asset)
        }

        const [info] = mobileInfoKey(configKey[0], address)
        const mobileInfo = await hemProgram.account.mobileHotspotInfoV0.fetch(
          info
        )
        const asset = await getAsset(rpcEndpoint, mobileInfo.asset)
        return hotspotInfoToDetails(mobileInfo, asset)
      } catch {
        return
      }
    },
    [hemProgram, rpcEndpoint]
  )

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
    submitSolana,
    submitAllSolana,
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

  if (dcAccount && dcAccount.lamports > 0) {
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

const hotspotInfoToDetails = (
  value: {
    asset: PublicKey
    bumpSeed: number
    isFullHotspot: boolean
    location: BN | null
    numLocationAsserts: number
    elevation: number | null
    gain: number | null
  },
  asset?: Asset
) => {
  const location = value.location?.toString('hex')
  const details = {
    elevation: value.elevation || undefined,
    gain: value.gain || undefined,
    location,
    isFullHotspot: value.isFullHotspot,
    numLocationAsserts: value.numLocationAsserts,
  } as HotspotMeta

  if (location) {
    const [lat, lng] = cellToLatLng(location)
    details.lat = lat
    details.lng = lng
  }

  details.owner = asset?.ownership.owner.toBase58()

  return details
}

export default useSolana
