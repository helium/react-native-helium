export type SolanaStatus = 'not_started' | 'in_progress' | 'complete'

const getSolanaStatus = async () => {
  const response = await fetch('https://solana-status.helium.com/')
  if (!response.ok) {
    throw new Error(response.statusText)
  }
  const json = (await response.json()) as {
    migrationStatus: SolanaStatus
  }

  return json.migrationStatus
}

export default getSolanaStatus
