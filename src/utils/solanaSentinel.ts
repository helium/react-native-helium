import { Cluster } from '@solana/web3.js'

export type SolanaStatus = 'not_started' | 'in_progress' | 'complete'

const BASE_URL = 'https://solana-status.helium.com'

//  TODO: Add caching to these queries

export const getSolanaStatus = async () => {
  const response = await fetch(BASE_URL)
  if (!response.ok) {
    throw new Error(response.statusText)
  }
  const json = (await response.json()) as {
    migrationStatus: SolanaStatus
  }

  return json.migrationStatus
}

type TokenType = 'mobile' | 'iot' | 'hnt' | 'dc'
export const getSolanaVars = async (cluster?: Cluster) => {
  let url = `${BASE_URL}/vars`
  if (cluster) {
    url = `${url}?cluster=${cluster}`
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(response.statusText)
  }
  const json = (await response.json()) as Record<
    TokenType,
    { metadata_url: string; mint: string }
  >

  return json
}
