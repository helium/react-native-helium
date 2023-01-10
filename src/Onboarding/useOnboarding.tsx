import { useCallback, useRef } from 'react'
import OnboardingClient from '@helium/onboarding'
import * as web3 from '@solana/web3.js'
import { Buffer } from 'buffer'
import { sendAndConfirmWithRetry } from '@helium/spl-utils'
import { Client, Hotspot, PendingTransaction } from '@helium/http'
import { useSolanaVars, useSolanaStatus } from '../utils/solanaSentinel'
import { subDaoKey } from '@helium/helium-sub-daos-sdk'
import {
  hotspotConfigKey,
  init,
  iotInfoKey,
} from '@helium/helium-entity-manager-sdk'
import { AnchorProvider, Wallet, Program } from '@project-serum/anchor'
import { SolHotspot } from './onboardingTypes'
import { HeliumEntityManager } from '@helium/idls/lib/types/helium_entity_manager'
import { heliumHttpClient } from '../utils/httpClient'
import { heliumAddressToSolPublicKey, SodiumKeyPair } from '../Account/account'
import { createAndSignAssertLocationTxn } from '../utils/assertLocation'
import Balance, {
  CurrencyType,
  DataCredits,
  NetworkTokens,
  SolTokens,
  TestNetworkTokens,
  USDollars,
} from '@helium/currency'
import { AssertLocationV2 } from '@helium/transactions'

export const TXN_FEE_IN_LAMPORTS = 5000
export const TXN_FEE_IN_SOL = TXN_FEE_IN_LAMPORTS / web3.LAMPORTS_PER_SOL

export const isSolHotspot = (
  hotspot: SolHotspot | Hotspot
): hotspot is SolHotspot => Object.keys(hotspot).includes('numLocationAsserts')

const useOnboarding = (
  baseUrl?: string,
  solanaCluster?: 'mainnet-beta' | 'devnet' | 'testnet'
) => {
  const { data: solanaStatus } = useSolanaStatus()
  const { data: solanaVars } = useSolanaVars(solanaCluster)
  const onboardingClient = useRef(new OnboardingClient(baseUrl))
  const solPubKey = useRef<web3.PublicKey>()
  const hemProgram = useRef<Program<HeliumEntityManager>>()
  const solConnection = useRef(
    new web3.Connection(web3.clusterApiUrl(solanaCluster))
  )

  const getHeliumEntityManagerProgram = useCallback(
    async (publicKey: web3.PublicKey) => {
      if (
        hemProgram.current &&
        solPubKey.current &&
        publicKey.equals(solPubKey.current)
      ) {
        return hemProgram.current
      }

      const provider = new AnchorProvider(
        solConnection.current,
        {
          publicKey,
        } as Wallet,
        {}
      )
      const nextHemProgram = await init(provider)

      hemProgram.current = nextHemProgram
      solPubKey.current = publicKey

      return nextHemProgram
    },
    []
  )

  const getMigrationStatus = useCallback(() => {
    const migrationStatus = solanaStatus?.migrationStatus

    if (migrationStatus === 'in_progress') {
      throw new Error('Chain migration in progress')
    }
    return migrationStatus
  }, [solanaStatus?.migrationStatus])

  const submitSolana = useCallback(async (txn: string) => {
    const { txid } = await sendAndConfirmWithRetry(
      solConnection.current,
      Buffer.from(txn),
      { skipPreflight: true },
      'confirmed'
    )

    return txid
  }, [])

  const submitAllSolana = useCallback(
    (txns: string[]) => {
      return Promise.all(txns.map(submitSolana))
    },
    [submitSolana]
  )

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

  const getSolHotspotInfo = useCallback(
    async ({
      iotMint,
      hotspotAddress,
      userSolPubKey,
    }: {
      iotMint: string
      hotspotAddress: string
      userSolPubKey: web3.PublicKey
    }) => {
      const program = await getHeliumEntityManagerProgram(userSolPubKey)

      const sdkey = subDaoKey(new web3.PublicKey(iotMint))[0]
      const hckey = hotspotConfigKey(sdkey, 'IOT')[0]
      const infoKey = iotInfoKey(hckey, hotspotAddress)[0]
      const info = await program.account.iotHotspotInfoV0.fetchNullable(infoKey)
      if (info) {
        return info as SolHotspot
      }
      return null
    },
    [getHeliumEntityManagerProgram]
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
      let pubKey = userSolPubKey

      if (userHeliumAddress && !userSolPubKey) {
        pubKey = heliumAddressToSolPublicKey(userHeliumAddress)
      }

      if (!pubKey) {
        throw new Error('User address is required')
      }

      const migrationStatus = getMigrationStatus()

      if (!solanaVars?.iot.mint) {
        throw new Error('Failed to fetch mint from solana vars')
      }

      if (migrationStatus === 'not_started') {
        return getHeliumHotspotInfo({ hotspotAddress, httpClient })
      }

      const hotspotInfo = await getSolHotspotInfo({
        iotMint: solanaVars.iot.mint,
        hotspotAddress,
        userSolPubKey: pubKey,
      })
      return hotspotInfo
    },
    [getHeliumHotspotInfo, getMigrationStatus, getSolHotspotInfo, solanaVars]
  )

  const addGateway = useCallback(
    async ({
      hotspotAddress,
      transaction,
      userSolPubKey,
      httpClient,
    }: {
      hotspotAddress: string
      transaction: string
      userSolPubKey: web3.PublicKey
      httpClient?: Client
    }): Promise<{
      solanaResponses?: string[]
      pendingTxn?: PendingTransaction
    }> => {
      const client = httpClient || heliumHttpClient
      const migrationStatus = getMigrationStatus()

      const hotspotExists = !!(await getHotspotForCurrentChain({
        hotspotAddress,
        userSolPubKey,
        httpClient: client,
      }))

      if (hotspotExists) {
        throw new Error('Hotspot already on chain')
      }

      const onboardResponse =
        await onboardingClient.current.postPaymentTransaction(
          hotspotAddress,
          transaction
        )

      handleError(
        onboardResponse,
        `unable to post payment transaction for ${hotspotAddress}`
      )

      if (migrationStatus === 'not_started') {
        if (!onboardResponse.data?.transaction) {
          throw new Error('Onboarding server failure - txn missing')
        }
        const pendingTxn = await client.transactions.submit(
          onboardResponse.data?.transaction
        )
        return {
          pendingTxn,
        }
      }

      if (!onboardResponse.data?.solanaTransactions) {
        throw new Error('Onboarding server failure - sol txn missing')
      }

      const solanaResponses = await submitAllSolana(
        onboardResponse.data.solanaTransactions
      )

      return {
        solanaResponses,
      }
    },
    [
      getHotspotForCurrentChain,
      handleError,
      getMigrationStatus,
      submitAllSolana,
    ]
  )

  const hasFreeAssert = useCallback(
    async ({ hotspot }: { hotspot?: Hotspot | SolHotspot | null }) => {
      if (!hotspot) {
        // TODO: Is this right?
        // assume free as it hasn't been added the chain
        return true
      }
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

      const onboardingRecord = await getOnboardingRecord(address)
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
      address,
      httpClient,
    }: {
      address: string
      httpClient?: Client
    }) => {
      const key = heliumAddressToSolPublicKey(address)
      const solBalance = await solConnection.current?.getBalance(key)

      const migrationStatus = getMigrationStatus()

      if (migrationStatus === 'complete') {
        // GET hnt Balance from solana
        //TODO: GET hnt Balance from solana
        return {
          hnt: undefined,
          sol: new Balance(solBalance, CurrencyType.solTokens),
        }
      } else {
        // GET hnt balance from helium
        const client = httpClient || heliumHttpClient
        const heliumBalances = await client.accounts.get(address)
        return {
          hnt: heliumBalances.balance,
          sol: new Balance(solBalance, CurrencyType.solTokens),
        }
      }
    },
    [getMigrationStatus]
  )

  const getAssertData = useCallback(
    async ({
      gateway,
      owner,
      maker,
      lat,
      lng,
      decimalGain,
      elevation,
      ownerKeypairRaw,
      httpClient,
      dataOnly,
    }: {
      gateway: string
      owner: string
      maker: string
      lat: number
      lng: number
      decimalGain?: number
      elevation?: number
      ownerKeypairRaw: SodiumKeyPair
      httpClient?: Client
      dataOnly?: boolean
    }): Promise<{
      balances?: {
        hnt: Balance<NetworkTokens | TestNetworkTokens> | undefined
        sol: Balance<SolTokens>
      }
      hasSufficientBalance: boolean
      hotspot: SolHotspot | Hotspot | null
      isFree: boolean
      totalStakingAmountDC?: Balance<DataCredits>
      totalStakingAmountHnt?: Balance<NetworkTokens>
      totalStakingAmountUsd?: Balance<USDollars>
      transaction?: AssertLocationV2
    }> => {
      const client = httpClient || heliumHttpClient
      const migrationStatus = getMigrationStatus()

      const hotspot = await getHotspotForCurrentChain({
        hotspotAddress: gateway,
        userHeliumAddress: owner,
      })
      const isFree = await hasFreeAssert({ hotspot })
      const transaction = await createAndSignAssertLocationTxn({
        gateway,
        owner,
        lat,
        lng,
        decimalGain,
        elevation,
        ownerKeypairRaw,
        maker,
        hotspot,
        isFree,
        dataOnly,
      })

      const balances = await getBalances({ address: owner, httpClient })
      let hasSufficientBalance = true

      // TODO: Where does oracle price come from in solana world?
      const oraclePrice = await client.oracle.getCurrentPrice()

      if (migrationStatus === 'not_started') {
        // if not free and we're still on helium the user needs hnt for fee and staking fee
        const totalStakingAmountDC = new Balance(
          (transaction.stakingFee || 0) + (transaction.fee || 0),
          CurrencyType.dataCredit
        )
        const totalStakingAmountHnt = totalStakingAmountDC.toNetworkTokens(
          oraclePrice.price
        )
        const totalStakingAmountUsd = totalStakingAmountDC.toUsd(
          oraclePrice.price
        )
        hasSufficientBalance =
          (balances.hnt?.integerBalance || 0) >=
          totalStakingAmountHnt.integerBalance

        return {
          balances,
          hasSufficientBalance,
          hotspot,
          isFree,
          totalStakingAmountDC,
          totalStakingAmountHnt,
          totalStakingAmountUsd,
          transaction,
        }
      }

      // if not free and we're on solana the user needs sol for txn fee and hnt for staking fee
      const hasSufficientSol = balances.sol.integerBalance > TXN_FEE_IN_SOL
      const totalStakingAmountDC = new Balance(
        transaction.stakingFee || 0,
        CurrencyType.dataCredit
      )
      const totalStakingAmountHnt = totalStakingAmountDC.toNetworkTokens(
        oraclePrice.price
      )
      const totalStakingAmountUsd = totalStakingAmountDC.toUsd(
        oraclePrice.price
      )
      const hasSufficientHnt =
        (balances.hnt?.integerBalance || 0) >=
        totalStakingAmountHnt.integerBalance
      hasSufficientBalance = hasSufficientHnt && hasSufficientSol

      return {
        balances,
        hasSufficientBalance,
        hotspot,
        isFree,
        totalStakingAmountDC,
        totalStakingAmountHnt,
        totalStakingAmountUsd,
        transaction,
      }
    },
    [getBalances, getHotspotForCurrentChain, hasFreeAssert, getMigrationStatus]
  )

  const assertLocation = useCallback(
    async ({
      gatewayAddress,
      transaction: originalTxn,
      isFree,
      httpClient,
    }: {
      gatewayAddress: string
      isFree?: boolean
      transaction: string
      httpClient?: Client
    }): Promise<{ solTxId?: string; pendingTxn?: PendingTransaction }> => {
      const migrationStatus = getMigrationStatus()

      let transaction = originalTxn
      const client = httpClient || heliumHttpClient

      if (isFree) {
        const onboardResponse =
          await onboardingClient.current.postPaymentTransaction(
            gatewayAddress,
            transaction
          )

        handleError(
          onboardResponse,
          `unable to post payment transaction for ${gatewayAddress}`
        )

        if (!onboardResponse?.data?.transaction) {
          throw new Error('failed to fetch txn from onboarding server')
        }
        transaction = onboardResponse.data?.transaction
      }

      if (migrationStatus === 'not_started') {
        const pendingTxn = await client.transactions.submit(transaction)
        return {
          pendingTxn,
        }
      }

      // submit to solana

      const solTxId = await submitSolana(transaction)
      return {
        solTxId,
      }
    },
    [handleError, getMigrationStatus, submitSolana]
  )

  const transferHotspot = useCallback(
    async ({
      transaction,
      httpClient,
    }: {
      transaction: string
      httpClient?: Client
    }): Promise<{ solTxId?: string; pendingTxn?: PendingTransaction }> => {
      const migrationStatus = getMigrationStatus()

      const client = httpClient || heliumHttpClient

      if (migrationStatus === 'not_started') {
        // submit to helium if transition not started
        const pendingTxn = await client.transactions.submit(transaction)
        return {
          pendingTxn,
        }
      }

      // submit to solana
      const solTxId = await submitSolana(transaction)
      return {
        solTxId,
      }
    },
    [getMigrationStatus, submitSolana]
  )

  return {
    addGateway,
    assertLocation,
    baseUrl,
    getAssertData,
    getHotspotForCurrentChain,
    getMakers,
    getMinFirmware,
    getOnboardingRecord,
    getSolHotspotInfo,
    hasFreeAssert,
    submitAllSolana,
    submitSolana,
    transferHotspot,
  }
}

export default useOnboarding
