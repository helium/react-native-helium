import { useCallback, useRef } from 'react'
import OnboardingClient from '@helium/onboarding'
import SolanaClient from '../utils/SolanaClient'

const useOnboarding = (
  baseUrl?: string,
  solanaCluster?: 'mainnet-beta' | 'devnet' | 'testnet'
) => {
  const onboardingClient = useRef(new OnboardingClient(baseUrl))
  const solanaClient = useRef(new SolanaClient(solanaCluster))

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
        const solanaResponses = await solanaClient.current.submitAll(
          response.data.solanaTransactions
        )
        return {
          transaction: response.data.transaction,
          solanaResponses,
        }
      }

      return { transaction: response.data.transaction, solanaResponses: [] }
    },
    [handleError]
  )

  return {
    getMinFirmware,
    getMakers,
    getOnboardingRecord,
    postPaymentTransaction,
    submitSolana: solanaClient.current.submit,
    submitAllSolana: solanaClient.current.submitAll,
  }
}

export default useOnboarding
