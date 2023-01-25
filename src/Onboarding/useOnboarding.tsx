import { useCallback, useRef } from 'react'
import OnboardingClient, { OnboardingRecord } from '@helium/onboarding'
import * as web3 from '@solana/web3.js'
import { Client, Hotspot, PendingTransaction } from '@helium/http'
import { useSolanaVars, useSolanaStatus } from '../utils/solanaSentinel'
import { Program } from '@project-serum/anchor'
import { AssertData } from './onboardingTypes'
import { HeliumEntityManager } from '@helium/idls/lib/types/helium_entity_manager'
import { heliumHttpClient } from '../utils/httpClient'
import {
  heliumAddressToSolAddress,
  heliumAddressToSolPublicKey,
  SodiumKeyPair,
} from '../Account/account'
import {
  createLocationTxn,
  getH3Location,
  getStakingFee,
} from '../utils/assertLocation'
import Balance, { CurrencyType, USDollars } from '@helium/currency'
// import { SolHotspot, Transfer } from '..'
import { SolHotspot } from '../types/solTypes'
import * as Transfer from '../utils/transferHotspot'
import {
  createHeliumEntityManagerProgram,
  getHeliumBalance,
  getSolBalance,
  getSolHotspotInfo,
  isSolHotspot,
  submitSolana,
  submitAllSolana,
  getOraclePriceFromSolana,
  getHotspots,
  createTransferCompressedCollectableTxn,
} from '../utils/solanaUtils'
import { Buffer } from 'buffer'
import OnboardingClientV3, { HotspotType } from './OnboardingClientV3'
import { BN } from 'bn.js'
import { WrappedConnection } from '../utils/WrappedConnection'

export const TXN_FEE_IN_LAMPORTS = 5000
export const TXN_FEE_IN_SOL = TXN_FEE_IN_LAMPORTS / web3.LAMPORTS_PER_SOL

export const SolanaConnection = {
  'devnet': new WrappedConnection('https://rpc-devnet.aws.metaplex.com/'),
  'testnet': new WrappedConnection(web3.clusterApiUrl('testnet')),
  'mainnet-beta': new WrappedConnection(web3.clusterApiUrl('mainnet-beta')),
} as const

// TODO: solana cluster / connection should be moved to it's own provider, so makers can reuse it in their apps
const useOnboarding = ({
  baseUrl,
  solanaCluster = 'devnet',
  v3BaseUrl,
}: {
  v3BaseUrl?: string
  baseUrl?: string
  solanaCluster?: 'mainnet-beta' | 'devnet' | 'testnet'
}) => {
  const { isHelium, isSolana, inProgress } = useSolanaStatus()
  const { data: solanaVars } = useSolanaVars(solanaCluster)
  const onboardingClient = useRef(new OnboardingClient(baseUrl))
  const onboardingV3Client = useRef(new OnboardingClientV3(v3BaseUrl))
  const solPubKey = useRef<web3.PublicKey>()
  const hemProgram = useRef<Program<HeliumEntityManager>>()
  const solConnection = useRef(SolanaConnection[solanaCluster])

  const getHeliumEntityManagerProgram = useCallback(
    async (publicKey: web3.PublicKey) => {
      if (
        hemProgram.current &&
        solPubKey.current &&
        publicKey.equals(solPubKey.current)
      ) {
        return hemProgram.current
      }

      const nextHemProgram = await createHeliumEntityManagerProgram({
        connection: solConnection.current,
        publicKey,
      })

      hemProgram.current = nextHemProgram
      solPubKey.current = publicKey

      return nextHemProgram
    },
    []
  )

  const checkSolanaStatus = useCallback(() => {
    if (inProgress) {
      throw new Error('Chain migration in progress')
    }
  }, [inProgress])

  const handleError = useCallback(
    (
      {
        success,
        errorMessage,
      }: {
        code: number
        success: boolean
        errorMessage?: string
        errors?: Array<any>
      },
      fallbackErrorMessage: string
    ) => {
      if (success) {
        return
      }

      throw new Error(errorMessage || fallbackErrorMessage)
    },
    []
  )

  const getMinFirmware = useCallback(async () => {
    const response = await onboardingClient.current.getFirmware()

    handleError(response, 'unable to get min firmware version')

    return response.data?.version || null
  }, [handleError])

  const getMakers = useCallback(async () => {
    const response = await onboardingClient.current.getMakers()

    handleError(response, 'unable to get makers')

    return response.data
  }, [handleError])

  const getOnboardingRecord = useCallback(
    async (hotspotAddress: string) => {
      try {
        const response = await onboardingClient.current.getOnboardingRecord(
          hotspotAddress
        )

        handleError(
          response,
          `unable to get onboarding record for ${hotspotAddress}`
        )

        return response.data
      } catch {}
      return null
    },
    [handleError]
  )

  const getHeliumHotspotInfo = useCallback(
    async ({
      hotspotAddress,
      httpClient,
    }: {
      hotspotAddress: string
      httpClient?: Client
    }) => {
      const client = httpClient || heliumHttpClient
      try {
        return await client.hotspots.get(hotspotAddress)
      } catch {
        return null
      }
    },
    []
  )

  const getHotspotForCurrentChain = useCallback(
    async ({
      hotspotAddress,
      userHeliumAddress,
      userSolPubKey,
      httpClient,
    }: {
      hotspotAddress: string
      userHeliumAddress?: string
      userSolPubKey?: web3.PublicKey
      httpClient?: Client
    }) => {
      checkSolanaStatus()
      let pubKey = userSolPubKey

      if (userHeliumAddress && !userSolPubKey) {
        pubKey = heliumAddressToSolPublicKey(userHeliumAddress)
      }

      if (!pubKey) {
        throw new Error('User address is required')
      }

      if (!solanaVars?.iot.mint) {
        throw new Error('Failed to fetch mint from solana vars')
      }

      if (isHelium) {
        return getHeliumHotspotInfo({ hotspotAddress, httpClient })
      }

      const hotspotInfo = await getSolHotspotInfo({
        iotMint: solanaVars.iot.mint,
        hotspotAddress,
        program: await getHeliumEntityManagerProgram(pubKey),
      })
      return hotspotInfo
    },
    [
      checkSolanaStatus,
      solanaVars,
      isHelium,
      getHeliumEntityManagerProgram,
      getHeliumHotspotInfo,
    ]
  )

  const getOnboardTransactions = useCallback(
    async ({
      txn,
      hotspotAddress,
      hotspotTypes,
      lat,
      lng,
      decimalGain,
      elevation,
    }: {
      txn: string
      hotspotAddress: string
      hotspotTypes: HotspotType[]
      lat?: number
      lng?: number
      decimalGain?: number
      elevation?: number
    }): Promise<{ addGatewayTxn?: string; solanaTransactions?: Buffer[] }> => {
      // TODO: check solana status, check if hotspot exists

      if (isHelium) {
        return { addGatewayTxn: txn }
      }

      const createTxns = await onboardingV3Client.current.createHotspot({
        transaction: txn,
      })

      await submitAllSolana({
        txns: createTxns.data.solanaTransactions.map((t) => Buffer.from(t)),
        connection: solConnection.current,
      })

      const gain = decimalGain ? Math.round(decimalGain * 10.0) : undefined

      let location: string | undefined
      if (lat && lng && lat !== 0 && lng !== 0) {
        location = getH3Location(lat, lng)
      }

      const promises = hotspotTypes.map((type) =>
        onboardingV3Client.current.onboard({
          hotspotAddress,
          type,
          gain,
          elevation,
          location,
        })
      )

      const solResponses = await Promise.all(promises)
      const solanaTransactions = solResponses
        .flatMap((r) => r.data.solanaTransactions)
        .map((tx) => Buffer.from(tx))

      if (!solanaTransactions?.length) {
        throw new Error('failed to create solana onboard txns')
      }

      return { solanaTransactions }
    },
    [isHelium]
  )

  const submitAddGateway = useCallback(
    async ({
      hotspotAddress,
      addGatewayTxn,
      solanaTransactions,
      userSolPubKey,
      userHeliumAddress,
      httpClient,
    }: {
      hotspotAddress: string
      userHeliumAddress?: string
      addGatewayTxn?: string
      solanaTransactions?: Buffer[]
      userSolPubKey?: web3.PublicKey
      httpClient?: Client
    }): Promise<{
      solanaTxnIds?: string[]
      pendingTxn?: PendingTransaction
    }> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient

      // TODO: Remove this check?
      const hotspotExists = !!(await getHotspotForCurrentChain({
        hotspotAddress,
        userSolPubKey,
        httpClient: client,
        userHeliumAddress,
      }))

      if (hotspotExists) {
        throw new Error('Hotspot already on chain')
      }

      if (isHelium) {
        if (!addGatewayTxn) {
          throw new Error('Transaction is missing')
        }
        // If L1 is helium, must submit to onboard server for payer signature
        const onboardResponse =
          await onboardingClient.current.postPaymentTransaction(
            hotspotAddress,
            addGatewayTxn
          )
        handleError(
          onboardResponse,
          `unable to post payment transaction for ${hotspotAddress}`
        )
        if (!onboardResponse.data?.transaction) {
          throw new Error('Onboarding server failure - txn missing')
        }

        // txn is now payerSignature is now signed by the maker, time to submit
        const pendingTxn = await client.transactions.submit(
          onboardResponse.data?.transaction
        )
        return {
          pendingTxn,
        }
      }

      if (!solanaTransactions?.length) {
        throw new Error('No solana transactions to submit')
      }

      const solanaTxnIds = await submitAllSolana({
        txns: solanaTransactions,
        connection: solConnection.current,
      })

      return {
        solanaTxnIds,
      }
    },
    [checkSolanaStatus, getHotspotForCurrentChain, handleError, isHelium]
  )

  const hasFreeAssert = useCallback(
    async ({
      hotspot,
      onboardingRecord: paramsOnboardRecord,
    }: {
      hotspot?: Hotspot | SolHotspot | null
      onboardingRecord?: OnboardingRecord | null
    }) => {
      if (!hotspot) {
        // TODO: Is this right?
        // assume free as it hasn't been added the chain
        return true
      }
      let onboardingRecord: OnboardingRecord | null | undefined =
        paramsOnboardRecord
      let address = ''
      if (isSolHotspot(hotspot)) {
        // TODO: Is this right?
        if (!hotspot.isFullHotspot) return false

        address = hotspot.hotspotKey
      } else {
        // TODO: Is this right?
        if (hotspot.mode !== 'full') return false

        address = hotspot.address
      }

      if (!onboardingRecord) {
        onboardingRecord = await getOnboardingRecord(address)
      }

      if (!onboardingRecord) {
        throw new Error('Onboarding record not found')
      }

      if (hotspot && isSolHotspot(hotspot)) {
        return (
          onboardingRecord.maker.locationNonceLimit > hotspot.numLocationAsserts
        )
      }

      return (
        onboardingRecord.maker.locationNonceLimit >
        (hotspot?.speculativeNonce || 0)
      )
    },
    [getOnboardingRecord]
  )

  const getBalances = useCallback(
    async ({
      heliumAddress,
      httpClient,
    }: {
      heliumAddress: string
      httpClient?: Client
    }) => {
      checkSolanaStatus()

      const solBalance = await getSolBalance({
        connection: solConnection.current,
        heliumAddress,
      })

      if (isSolana) {
        // GET hnt Balance from solana
        if (!solanaVars?.hnt.mint) {
          throw new Error('Hnt mint not found')
        }
        const hntAmount = await getHeliumBalance({
          connection: solConnection.current,
          mint: solanaVars?.hnt.mint,
          heliumAddress,
        })

        return {
          hnt: new Balance(hntAmount || 0, CurrencyType.networkToken),
          sol: new Balance(solBalance, CurrencyType.solTokens),
        }
      } else {
        // GET hnt balance from helium
        const client = httpClient || heliumHttpClient
        const heliumBalances = await client.accounts.get(heliumAddress)
        return {
          hnt: heliumBalances.balance,
          sol: new Balance(solBalance, CurrencyType.solTokens),
        }
      }
    },
    [checkSolanaStatus, isSolana, solanaVars?.hnt.mint]
  )

  const getOraclePrice = useCallback(
    async (httpClient?: Client): Promise<Balance<USDollars>> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient
      if (isHelium) {
        const oraclePrice = await client.oracle.getCurrentPrice()
        if (!oraclePrice.price) {
          throw new Error('Failed to fetch oracle price from helium blockchain')
        }
        return oraclePrice.price
      }

      const hntPrice = await getOraclePriceFromSolana({
        connection: solConnection.current,
        cluster: solanaCluster,
        tokenType: 'HNT',
      })

      return Balance.fromFloat(hntPrice, CurrencyType.usd)
    },
    [checkSolanaStatus, isHelium, solanaCluster]
  )
  const getAssertData = useCallback(
    async ({
      gateway,
      owner,
      lat,
      lng,
      decimalGain = 1.2,
      elevation = 0,
      ownerKeypairRaw,
      httpClient,
      dataOnly,
      hotspotTypes,
      onboardingRecord: paramsOnboardRecord,
      createSolanaTransactions = true,
    }: {
      gateway: string
      owner: string
      lat: number
      lng: number
      decimalGain?: number
      elevation?: number
      ownerKeypairRaw?: SodiumKeyPair
      httpClient?: Client
      dataOnly?: boolean
      hotspotTypes: HotspotType[]
      onboardingRecord?: OnboardingRecord | null
      createSolanaTransactions?: boolean
    }): Promise<AssertData> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient

      let onboardingRecord: OnboardingRecord | null | undefined =
        paramsOnboardRecord

      const gain = Math.round(decimalGain * 10.0)

      const hotspot = await getHotspotForCurrentChain({
        hotspotAddress: gateway,
        userHeliumAddress: owner,
      })

      if (!onboardingRecord) {
        onboardingRecord = await getOnboardingRecord(gateway)
      }

      if (!onboardingRecord) {
        throw new Error('Onboarding record not found')
      }

      const isFree = await hasFreeAssert({ hotspot, onboardingRecord })

      const maker = onboardingRecord.maker
      const payer = isFree ? maker.address : owner

      const nextLocation = getH3Location(lat, lng)

      let updatingLocation = !hotspot
      if (hotspot) {
        if (isHelium) {
          updatingLocation = hotspot.location !== nextLocation
        } else if (hotspot.location) {
          // TODO: Not sure if this is correct
          const loc = hotspot.location.toString('hex')
          updatingLocation = loc !== nextLocation
        }
      }

      const balances = await getBalances({ heliumAddress: owner, httpClient })
      let hasSufficientBalance = true

      // TODO: Where does oracle price come from in solana world?
      const oraclePrice = await getOraclePrice(client)

      if (isHelium) {
        const transaction = await createLocationTxn({
          gateway,
          owner,
          gain,
          elevation,
          ownerKeypairRaw,
          maker: onboardingRecord.maker.address,
          hotspot,
          isFree,
          dataOnly,
          nextLocation,
          updatingLocation,
        })
        let txnStr = transaction.toString()
        const totalStakingAmountDC = new Balance(
          (transaction.stakingFee || 0) + (transaction.fee || 0),
          CurrencyType.dataCredit
        )
        const totalStakingAmountHnt =
          totalStakingAmountDC.toNetworkTokens(oraclePrice)
        const totalStakingAmountUsd = totalStakingAmountDC.toUsd(oraclePrice)
        // if not free and we're still on helium the user needs hnt for fee and staking fee
        hasSufficientBalance = isFree
          ? true
          : (balances.hnt?.integerBalance || 0) >=
            totalStakingAmountHnt.integerBalance

        return {
          balances,
          hasSufficientBalance,
          hotspot,
          isFree,
          heliumFee: {
            dc: totalStakingAmountDC,
            hnt: totalStakingAmountHnt,
            usd: totalStakingAmountUsd,
          },
          solFee: new Balance(0, CurrencyType.solTokens),
          assertLocationTxn: txnStr,
          payer,
          maker,
        }
      }

      // if not free and we're on solana the user needs sol for txn fee and hnt for staking fee
      const stakingFee = getStakingFee({ dataOnly, updatingLocation })

      //TODO: Fees will be charged for each network. Verify this is correct.
      const multiplier = hotspotTypes.length

      const totalStakingAmountDC = new Balance(
        stakingFee,
        CurrencyType.dataCredit
      ).times(multiplier)

      const totalStakingAmountHnt =
        totalStakingAmountDC.toNetworkTokens(oraclePrice)

      const totalStakingAmountUsd = totalStakingAmountDC.toUsd(oraclePrice)

      const solFee = new Balance(TXN_FEE_IN_SOL, CurrencyType.solTokens).times(
        multiplier
      )

      if (isFree) {
        hasSufficientBalance = true
      } else {
        const hasSufficientSol = balances.sol.integerBalance > TXN_FEE_IN_SOL
        const hasSufficientHnt =
          (balances.hnt?.integerBalance || 0) >=
          totalStakingAmountHnt.integerBalance
        hasSufficientBalance = hasSufficientHnt && hasSufficientSol
      }

      let solanaTransactions: Buffer[] | undefined

      if (createSolanaTransactions) {
        const solanaAddress = heliumAddressToSolAddress(owner)
        const location = new BN(nextLocation, 'hex').toString()

        const promises = hotspotTypes.map((type) =>
          onboardingV3Client.current.updateMetadata({
            type,
            solanaAddress,
            hotspotAddress: gateway,
            location,
            elevation,
            gain,
          })
        )
        const solResponses = await Promise.all(promises)
        solanaTransactions = solResponses
          .flatMap((r) => r.data.solanaTransactions)
          .map((txn) => Buffer.from(txn))
      }
      return {
        balances,
        hasSufficientBalance,
        hotspot,
        isFree,
        heliumFee: {
          dc: totalStakingAmountDC,
          hnt: totalStakingAmountHnt,
          usd: totalStakingAmountUsd,
        },
        solFee,
        solanaTransactions,
        payer,
        maker,
      }
    },
    [
      checkSolanaStatus,
      getHotspotForCurrentChain,
      hasFreeAssert,
      getBalances,
      getOraclePrice,
      isHelium,
      getOnboardingRecord,
    ]
  )

  const submitAssertLocation = useCallback(
    async ({
      assertLocationTxn,
      solanaTransactions,
      httpClient,
      gateway,
    }: {
      assertLocationTxn?: string
      solanaTransactions?: Buffer[]
      httpClient?: Client
      gateway: string
    }): Promise<{
      solanaTxnIds?: string[]
      pendingTxn?: PendingTransaction
    }> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient

      if (assertLocationTxn) {
        let txnStr = assertLocationTxn

        const hotspot = await getHeliumHotspotInfo({
          hotspotAddress: gateway,
          httpClient,
        })

        const isFree = await hasFreeAssert({ hotspot })
        if (isFree) {
          // If L1 is helium and txn is free, must submit to onboard server for payer signature
          const onboardResponse =
            await onboardingClient.current.postPaymentTransaction(
              gateway,
              assertLocationTxn.toString()
            )

          handleError(
            onboardResponse,
            `unable to post payment transaction for ${gateway}`
          )

          if (!onboardResponse?.data?.transaction) {
            throw new Error('failed to fetch txn from onboarding server')
          }
          txnStr = onboardResponse.data?.transaction
        }
        const pendingTxn = await client.transactions.submit(txnStr)
        return {
          pendingTxn,
        }
      }

      if (!solanaTransactions?.length) {
        throw new Error('No solana transactions to submit')
      }

      const solanaTxnIds = await submitAllSolana({
        txns: solanaTransactions,
        connection: solConnection.current,
      })
      return {
        solanaTxnIds,
      }
    },
    [getHeliumHotspotInfo, checkSolanaStatus, handleError, hasFreeAssert]
  )

  const submitTransferHotspot = useCallback(
    async ({
      transferHotspotTxn,
      solanaTransaction,
      httpClient,
    }: {
      transferHotspotTxn?: string
      solanaTransaction?: Buffer
      httpClient?: Client
    }): Promise<{ solTxId?: string; pendingTxn?: PendingTransaction }> => {
      if (!transferHotspotTxn && !solanaTransaction) {
        throw new Error('No txn found')
      }

      const client = httpClient || heliumHttpClient

      if (transferHotspotTxn) {
        // submit to helium if transition not started
        const pendingTxn = await client.transactions.submit(transferHotspotTxn)
        return {
          pendingTxn,
        }
      }

      // submit to solana
      const solTxId = await submitSolana({
        txn: solanaTransaction!,
        connection: solConnection.current,
      })
      return {
        solTxId,
      }
    },
    []
  )

  const createTransferTransaction = useCallback(
    async ({
      hotspotAddress,
      userAddress,
      newOwnerAddress,
      ownerKeypairRaw,
      httpClient,
    }: {
      hotspotAddress: string
      userAddress: string
      newOwnerAddress: string
      ownerKeypairRaw?: SodiumKeyPair
      httpClient?: Client
    }): Promise<{
      transferHotspotTxn?: string | undefined
      solanaTransaction?: Buffer | undefined
    }> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient

      if (isHelium) {
        const txn = await Transfer.createTransferTransaction({
          hotspotAddress,
          userAddress,
          newOwnerAddress,
          client,
          ownerKeypairRaw,
        })
        return { transferHotspotTxn: txn.toString() }
      }

      const hotspots = await getHotspots({
        heliumAddress: userAddress,
        connection: solConnection.current,
        oldestCollectable: '',
      })

      const hotspot = hotspots.find((h) => {
        const addy = h.content.json_uri.split('/').slice(-1)[0]
        return addy === hotspotAddress
      })

      if (!hotspot) {
        throw new Error('Hotspot not found for user')
      }

      const txn = await createTransferCompressedCollectableTxn({
        ownerHeliumAddress: userAddress,
        newOwnerHeliumAddress: newOwnerAddress,
        connection: solConnection.current,
        collectable: hotspot,
      })
      return { solanaTransaction: Buffer.from(txn.serialize()) }
    },
    [isHelium, checkSolanaStatus]
  )

  const submitSolanaTransactions = useCallback(
    async ({
      solanaTransactions,
      encoding = 'base64',
    }: {
      solanaTransactions: string[]
      encoding?: BufferEncoding
    }) => {
      return submitAllSolana({
        txns: solanaTransactions.map((txn) => Buffer.from(txn, encoding)),
        connection: solConnection.current,
      })
    },
    []
  )

  return {
    baseUrl,
    createTransferTransaction,
    getAssertData,
    getHotspotForCurrentChain,
    getMakers,
    getMinFirmware,
    getOnboardingRecord,
    getOnboardTransactions,
    getOraclePrice,
    hasFreeAssert,
    submitAddGateway,
    submitSolanaTransactions,
    submitAssertLocation,
    submitTransferHotspot,
    solanaStatus: {
      isHelium,
      isSolana,
      inProgress,
    },
  }
}

export default useOnboarding
