import { useCallback, useRef } from 'react'
import OnboardingClient from '@helium/onboarding'

const useOnboarding = (baseUrl?: string) => {
  const onboardingClient = useRef(new OnboardingClient(baseUrl))

  const handleError = useCallback(
    ({
      success,
      errorMessage,
    }: {
      code: number
      success: boolean
      errorMessage?: string
      errors?: Array<any>
    }) => {
      if (success) {
        return
      }

      throw new Error(errorMessage || 'Onboarding client error')
    },
    []
  )

  const getMinFirmware = useCallback(async () => {
    const response = await onboardingClient.current.getFirmware()

    handleError(response)

    return response.data?.version || null
  }, [handleError])

  const getMakers = useCallback(async () => {
    const response = await onboardingClient.current.getMakers()

    handleError(response)

    return response.data
  }, [handleError])

  const getOnboardingRecord = useCallback(
    async (hotspotAddress: string) => {
      const response = await onboardingClient.current.getOnboardingRecord(
        hotspotAddress
      )

      handleError(response)

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

      handleError(response)

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
