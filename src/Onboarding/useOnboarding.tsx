import { useCallback, useRef } from 'react'
import OnboardingClient from '@helium/onboarding'
import * as web3 from '@solana/web3.js'
import { Client, Hotspot, PendingTransaction } from '@helium/http'
import { useSolanaVars, useSolanaStatus } from '../utils/solanaSentinel'
import { Program } from '@project-serum/anchor'
import { AssertData } from './onboardingTypes'
import { HeliumEntityManager } from '@helium/idls/lib/types/helium_entity_manager'
import { heliumHttpClient } from '../utils/httpClient'
import { heliumAddressToSolPublicKey, SodiumKeyPair } from '../Account/account'
import {
  createLocationTxn,
  getH3Location,
  getStakingFee,
} from '../utils/assertLocation'
import Balance, { CurrencyType } from '@helium/currency'
import { Transfer } from '..'
import {
  createHeliumEntityManagerProgram,
  getHeliumBalance,
  getSolBalance,
  getSolHotspotInfo,
  isSolHotspot,
  SolHotspot,
  submitSolana,
} from '../utils/solanaUtils'

export const TXN_FEE_IN_LAMPORTS = 5000
export const TXN_FEE_IN_SOL = TXN_FEE_IN_LAMPORTS / web3.LAMPORTS_PER_SOL

const useOnboarding = (
  baseUrl?: string,
  solanaCluster?: 'mainnet-beta' | 'devnet' | 'testnet'
) => {
  const { isHelium, isSolana, inProgress } = useSolanaStatus()
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

  const submitAddGateway = useCallback(
    async ({
      hotspotAddress,
      transaction,
      userSolPubKey,
      userHeliumAddress,
      httpClient,
    }: {
      hotspotAddress: string
      userHeliumAddress?: string
      transaction: string
      userSolPubKey?: web3.PublicKey
      httpClient?: Client
    }): Promise<{
      solanaResponses?: string[]
      pendingTxn?: PendingTransaction
    }> => {
      checkSolanaStatus()
      const client = httpClient || heliumHttpClient

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
        // If L1 is helium, must submit to onboard server for payer signature
        const onboardResponse =
          await onboardingClient.current.postPaymentTransaction(
            hotspotAddress,
            transaction
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

      // TODO: Update to use onboard server v3
      // 1. submit txn (signed by gateway and owner) to v3 onboard server
      // 2. submit to solana
      // 3. Return txn id
      return {
        solanaResponses: [],
      }
    },
    [checkSolanaStatus, getHotspotForCurrentChain, handleError, isHelium]
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
      checkSolanaStatus()

      const solBalance = await getSolBalance({
        connection: solConnection.current,
        heliumAddress: address,
      })

      if (isSolana) {
        // GET hnt Balance from solana
        if (!solanaVars?.hnt.mint) {
          throw new Error('Hnt mint not found')
        }
        const hntAmount = await getHeliumBalance({
          connection: solConnection.current,
          mint: solanaVars?.hnt.mint,
          address: address,
        })

        return {
          hnt: new Balance(hntAmount || 0, CurrencyType.networkToken),
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
    [checkSolanaStatus, isSolana, solanaVars?.hnt.mint]
  )

  const getAssertData = useCallback(
    async ({
      gateway,
      owner,
      maker,
      lat,
      lng,
      decimalGain = 1.2,
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
      ownerKeypairRaw?: SodiumKeyPair
      httpClient?: Client
      dataOnly?: boolean
    }): Promise<AssertData> => {
      checkSolanaStatus()
      const client = httpClient || heliumHttpClient
      const gain = decimalGain * 10

      const hotspot = await getHotspotForCurrentChain({
        hotspotAddress: gateway,
        userHeliumAddress: owner,
      })

      const isFree = await hasFreeAssert({ hotspot })

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

      const balances = await getBalances({ address: owner, httpClient })
      let hasSufficientBalance = true

      // TODO: Where does oracle price come from in solana world?
      const oraclePrice = await client.oracle.getCurrentPrice()

      if (isHelium) {
        const transaction = await createLocationTxn({
          gateway,
          owner,
          lat,
          lng,
          gain,
          elevation,
          ownerKeypairRaw,
          maker,
          hotspot,
          isFree,
          dataOnly,
          nextLocation,
          updatingLocation,
        })
        let txnStr = transaction.toString()
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
          heliumFee: {
            dc: totalStakingAmountDC,
            hnt: totalStakingAmountHnt,
            usd: totalStakingAmountUsd,
          },
          solFee: new Balance(0, CurrencyType.solTokens),
          transaction: txnStr,
        }
      }

      // if not free and we're on solana the user needs sol for txn fee and hnt for staking fee
      const hasSufficientSol = balances.sol.integerBalance > TXN_FEE_IN_SOL
      const stakingFee = getStakingFee({ dataOnly, updatingLocation })
      const totalStakingAmountDC = new Balance(
        stakingFee,
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
        heliumFee: {
          dc: totalStakingAmountDC,
          hnt: totalStakingAmountHnt,
          usd: totalStakingAmountUsd,
        },
        solFee: new Balance(TXN_FEE_IN_SOL, CurrencyType.solTokens),
        transaction: '', // TODO: Submit to onboarding server v3 to get solana txn, then sign it
      }
    },
    [
      checkSolanaStatus,
      getHotspotForCurrentChain,
      hasFreeAssert,
      getBalances,
      isHelium,
    ]
  )

  const submitAssertLocation = useCallback(
    async ({
      transaction,
      httpClient,
      gateway,
    }: {
      transaction: string
      httpClient?: Client
      gateway: string
    }): Promise<{ solTxId?: string; pendingTxn?: PendingTransaction }> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient

      if (isHelium) {
        let txnStr = transaction

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
              transaction.toString()
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

      // submit to solana
      const solTxId = await submitSolana({
        txn: transaction,
        connection: solConnection.current,
      })
      return {
        solTxId,
      }
    },
    [
      getHeliumHotspotInfo,
      checkSolanaStatus,
      handleError,
      hasFreeAssert,
      isHelium,
    ]
  )

  const submitTransferHotspot = useCallback(
    async ({
      transaction,
      httpClient,
    }: {
      transaction: string
      httpClient?: Client
    }): Promise<{ solTxId?: string; pendingTxn?: PendingTransaction }> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient

      if (isHelium) {
        // submit to helium if transition not started
        const pendingTxn = await client.transactions.submit(transaction)
        return {
          pendingTxn,
        }
      }

      // submit to solana
      const solTxId = await submitSolana({
        txn: transaction,
        connection: solConnection.current,
      })
      return {
        solTxId,
      }
    },
    [checkSolanaStatus, isHelium]
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
    }) => {
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
        return txn.toString()
      }

      // TODO: Handle Solana
      // 1. Somehow determine if the hotspot is stale
      // 2. Fetch from onboarding v3
      // 3. Return the txn
      return ''
    },
    [isHelium, checkSolanaStatus]
  )

  return {
    baseUrl,
    createTransferTransaction,
    getAssertData,
    getHotspotForCurrentChain,
    getMakers,
    getMinFirmware,
    getOnboardingRecord,
    hasFreeAssert,
    submitAddGateway,
    submitAssertLocation,
    submitTransferHotspot,
  }
}

export default useOnboarding
