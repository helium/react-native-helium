export type SolanaStatus = 'not_started' | 'in_progress' | 'complete'

const BASE_URL = 'https://solana-status.helium.com'

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
export const getSolanaVars = async () => {
  const response = await fetch(`${BASE_URL}/vars`)
  if (!response.ok) {
    throw new Error(response.statusText)
  }
  const json = (await response.json()) as {
    mints: Record<TokenType, string>
    metadata_urls: Record<TokenType, string>
  }

  return json
}
