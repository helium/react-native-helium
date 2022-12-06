const solanaStatus = async () => {
  const response = await fetch('https://solana-status.helium.com/')
  if (!response.ok) {
    throw new Error(response.statusText)
  }
  const json = (await response.json()) as {
    migrationStatus: 'not_started' | 'in_progress' | 'complete'
  }

  return json.migrationStatus
}

export default solanaStatus
