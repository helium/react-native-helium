import { Cluster } from '@solana/web3.js'
import useSWR from 'swr'

export type SolanaStatus = 'not_started' | 'in_progress' | 'complete'

const BASE_URL = 'https://solana-status.helium.com'

const fetcher = (url: RequestInfo) => fetch(url).then((res) => res.json())

export type TokenType = 'mobile' | 'iot' | 'hnt' | 'dc'

export const useSolanaVars = (cluster?: Cluster) => {
  let url = `${BASE_URL}/vars`
  if (cluster) {
    url = `${url}?cluster=${cluster}`
  }

  return useSWR<Record<TokenType, { metadata_url: string; mint: string }>>(
    url,
    fetcher
  )
}

export const useSolanaStatus = () => {
  const { data: solanaStatus } = useSWR<{
    migrationStatus: SolanaStatus
  }>(BASE_URL, fetcher)

  return {
    isSolana: solanaStatus?.migrationStatus === 'complete',
    isHelium: solanaStatus?.migrationStatus === 'not_started',
    inProgress: solanaStatus?.migrationStatus === 'in_progress',
    migrationStatus: solanaStatus?.migrationStatus,
  }
}
