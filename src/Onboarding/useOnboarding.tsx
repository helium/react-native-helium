import { useCallback, useRef } from 'react'
import OnboardingClient from '@helium/onboarding'

const useOnboarding = (baseUrl?: string) => {
  const onboardingClient = useRef(new OnboardingClient(baseUrl))

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

      return response.data?.transaction || null
    },
    [handleError]
  )

  return {
    getMinFirmware,
    getMakers,
    getOnboardingRecord,
    postPaymentTransaction,
  }
}

export default useOnboarding
