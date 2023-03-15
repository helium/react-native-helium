import { useCallback, useRef } from 'react'
import usePrevious from '../utils/usePrevious'

export type SolanaStatus = 'not_started' | 'in_progress' | 'complete'

const BASE_URL = 'https://solana-status.helium.com'

export const useSolanaStatus = (solanaStatusOverride?: SolanaStatus) => {
  const status = useRef<{
    isSolana: boolean
    isHelium: boolean
    inProgress: boolean
    migrationStatus: SolanaStatus
  }>()

  const prevOverrideStatus = usePrevious(solanaStatusOverride)

  const getStatus = useCallback(async () => {
    if (status.current && prevOverrideStatus === solanaStatusOverride) {
      return status.current
    }

    if (solanaStatusOverride) {
      const nextStatus = {
        isSolana: solanaStatusOverride === 'complete',
        isHelium: solanaStatusOverride === 'not_started',
        inProgress: solanaStatusOverride === 'in_progress',
        migrationStatus: solanaStatusOverride,
      }
      status.current = nextStatus
      return nextStatus
    }

    let migrationStatus: SolanaStatus = 'complete'
    try {
      const response = (await (await fetch(BASE_URL)).json()) as {
        migrationStatus: SolanaStatus
      }

      if (response?.migrationStatus) {
        migrationStatus = response.migrationStatus
      }
    } catch (e) {
      console.log(e)
    }

    const nextStatus = {
      isSolana: migrationStatus === 'complete',
      isHelium: migrationStatus === 'not_started',
      inProgress: migrationStatus === 'in_progress',
      migrationStatus,
    }
    status.current = nextStatus
    return nextStatus
  }, [prevOverrideStatus, solanaStatusOverride])

  return getStatus
}
