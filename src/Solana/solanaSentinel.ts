import { useCallback, useState } from 'react'

export type SolanaStatus = 'not_started' | 'in_progress' | 'complete'

const BASE_URL = 'https://solana-status.helium.com'

export const useSolanaStatus = (solanaStatusOverride?: SolanaStatus) => {
  const [status, setStatus] = useState<{
    isSolana: boolean
    isHelium: boolean
    inProgress: boolean
    migrationStatus: SolanaStatus
  }>()

  const getStatus = useCallback(async () => {
    if (status) return status

    if (solanaStatusOverride) {
      const nextStatus = {
        isSolana: solanaStatusOverride === 'complete',
        isHelium: solanaStatusOverride === 'not_started',
        inProgress: solanaStatusOverride === 'in_progress',
        migrationStatus: solanaStatusOverride,
      }
      setStatus(nextStatus)
      return nextStatus
    }

    const response = (await (await fetch(BASE_URL)).json()) as {
      migrationStatus: SolanaStatus
    }
    const migrationStatus = response?.migrationStatus
    const nextStatus = {
      isSolana: migrationStatus === 'complete',
      isHelium: migrationStatus === 'not_started',
      inProgress: migrationStatus === 'in_progress',
      migrationStatus,
    }
    setStatus(nextStatus)
    return nextStatus
  }, [solanaStatusOverride, status])

  return getStatus
}
