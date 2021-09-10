import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { DiagnosticInfo, useHotspotBle } from '@helium/react-native-sdk'

const Diagnostics = () => {
  const [diagnosticInfo, setDiagnosticInfo] = useState<DiagnosticInfo>()
  const { getDiagnosticInfo } = useHotspotBle()

  useEffect(() => {
    getDiagnosticInfo().then(setDiagnosticInfo)
  }, [getDiagnosticInfo])

  return (
    <View style={styles.container}>
      {diagnosticInfo && (
        <Text style={styles.text}>
          {JSON.stringify(diagnosticInfo, null, 2)}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  text: { fontSize: 19 },
})

export default Diagnostics
