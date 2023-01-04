import { useCallback, useRef } from 'react'
import OnboardingClient from '@helium/onboarding'
import * as web3 from '@solana/web3.js'
import { Buffer } from 'buffer'
import { sendAndConfirmWithRetry } from '@helium/spl-utils'
import { getSolanaStatus, heliumHttpClient } from '@helium/react-native-sdk'
import { Client, PendingTransaction } from '@helium/http'
import { getSolanaVars, SolanaStatus } from '../utils/solanaSentinel'

const useOnboarding = (
  baseUrl?: string,
  solanaCluster?: 'mainnet-beta' | 'devnet' | 'testnet'
) => {
  const onboardingClient = useRef(new OnboardingClient(baseUrl))
  const solConnection = useRef(
    new web3.Connection(web3.clusterApiUrl(solanaCluster))
  )

  const submit = useCallback(async (txn: string) => {
    const { txid } = await sendAndConfirmWithRetry(
      solConnection.current,
      Buffer.from(txn),
      { skipPreflight: true },
      'confirmed'
    )

    return txid
  }, [])

  const submitAll = useCallback(
    (txns: string[]) => {
      return Promise.all(txns.map(submit))
    },
    [submit]
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
      const response = await onboardingClient.current.getOnboardingRecord(
        hotspotAddress
      )

      handleError(
        response,
        `unable to get onboarding record for ${hotspotAddress}`
      )

      return response.data
    },
    [handleError]
  )

  const postPaymentTransaction = useCallback(
    async (hotspotAddress: string, transaction: string) => {
      const response = await onboardingClient.current.postPaymentTransaction(
        hotspotAddress,
        transaction
      )

      handleError(
        response,
        `unable to post payment transaction for ${hotspotAddress}`
      )

      if (!response.data) {
        return null
      }

      if (response.data.solanaTransactions?.length) {
        const solanaResponses = await submitAll(
          response.data.solanaTransactions
        )
        return {
          transaction: response.data.transaction,
          solanaResponses,
        }
      }

      return { transaction: response.data.transaction, solanaResponses: [] }
    },
    [handleError, submitAll]
  )

  const hotspotOnChain = useCallback(
    async (
      hotspotAddress: string,
      solanaStatus: SolanaStatus,
      httpClient?: Client
    ) => {
      const client = httpClient || heliumHttpClient

      if (solanaStatus === 'complete') {
        const {
          metadata_urls: { iot },
        } = await getSolanaVars()
        const response = await fetch(`${iot}/${hotspotAddress}`)
        return response.status === 200
      } else {
        try {
          const hotspot = await client.hotspots.get(hotspotAddress)
          return !!hotspot
        } catch (e) {
          return false
        }
      }
    },
    []
  )

  const addGateway = useCallback(
    async (
      hotspotAddress: string,
      transaction: string,
      httpClient?: Client
    ) => {
      const client = httpClient || heliumHttpClient

      const solanaStatus = await getSolanaStatus()
      if (solanaStatus === 'in_progress') {
        throw new Error('Chain transfer in progress')
      }

      const hotspotExists = await hotspotOnChain(
        hotspotAddress,
        solanaStatus,
        client
      )

      if (hotspotExists) {
        throw new Error('Hotspot already on chain')
      }

      let submitStatus: 'failure' | 'complete' | 'pending' = 'failure'

      const response = await postPaymentTransaction(hotspotAddress, transaction)
      if (!response) return null

      if (solanaStatus === 'complete') {
        submitStatus = 'complete'
      }

      let pendingTxn: null | PendingTransaction = null
      if (response?.transaction && solanaStatus === 'not_started') {
        pendingTxn = await client.transactions.submit(response.transaction)
        submitStatus = 'pending'
      }

      return { pendingTxn, ...response, solanaStatus, submitStatus }
    },
    [hotspotOnChain, postPaymentTransaction]
  )

  return {
    addGateway,
    baseUrl,
    getMinFirmware,
    getMakers,
    getOnboardingRecord,
    postPaymentTransaction,
    submitSolana: submit,
    submitAllSolana: submitAll,
  }
}

export default useOnboarding
