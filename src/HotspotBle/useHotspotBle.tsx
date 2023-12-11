import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BleManager,
  Device,
  LogLevel,
  BleError,
  Characteristic,
  Subscription,
  Base64,
} from 'react-native-ble-plx'
import compareVersions from 'compare-versions'
import {
  encodeAddGateway,
  encodeWifiConnect,
  encodeWifiRemove,
  parseChar,
} from './bleParse'
import {
  FirmwareCharacteristic,
  HotspotCharacteristic,
  Service,
} from './bleTypes'
import { signGatewayTxn, calculateAddGatewayFee } from '../utils/addGateway'
import { decode } from 'base-64'
import type { SodiumKeyPair } from '../Account/account'
import { AddGatewayV1 } from '@helium/transactions'

export enum HotspotErrorCode {
  WAIT = 'wait',
  UNKNOWN = 'unknown',
  BAD_ARGS = 'badargs',
  ERROR = 'error',
  GATEWAY_NOT_FOUND = 'gw_not_found', // This may no longer be relevant, but it's not hurting anything check for it
}

const WifiStatusKeys = ['connected', 'invalid', 'not_found'] as const
export type WifiStatusType = (typeof WifiStatusKeys)[number]

const useHotspotBle = () => {
  const instanceRef = useRef<BleManager | null>(null)
  const [devices, setDevices] = useState<Record<string, Device>>({})
  const [device, setDevice] = useState<Device>()

  const scannedDevices = useMemo(
    () => Object.keys(devices).map((id) => devices[id]),
    [devices]
  )

  const getBleManager = () => {
    const instance = instanceRef.current
    if (instance !== null) {
      return instance
    }

    console.log('create ble manager')
    const newInstance = new BleManager()
    instanceRef.current = newInstance

    if (__DEV__) {
      console.log('setting ble log level to verbose')
      instanceRef.current.setLogLevel(LogLevel.Verbose)
    }

    return newInstance
  }

  useEffect(() => {
    const manager = getBleManager()
    console.log('manager create')

    return () => {
      console.log('destroy ble manager')
      ;(async () => {
        const state = await manager.state()
        if (state === 'PoweredOn') {
          manager.destroy()
        }
      })()

      instanceRef.current = null
    }
  }, [])

  const resetDevices = useCallback(() => setDevices({}), [])

  const startScan = useCallback(
    async (callback: (error: BleError | null) => void) => {
      resetDevices()

      getBleManager().startDeviceScan(
        [Service.MAIN_UUID],
        { allowDuplicates: false },
        (error, dev) => {
          if (dev) {
            setDevices((prevDevices) => ({
              ...prevDevices,
              [dev.id]: dev,
            }))
          }
          if (error) callback(error)
        }
      )
    },
    [resetDevices]
  )

  const stopScan = useCallback(() => getBleManager().stopDeviceScan(), [])

  const connect = useCallback(async (hotspotDevice: Device) => {
    const connected = await hotspotDevice.connect({
      refreshGatt: 'OnConnected',
    })
    setDevice(connected)
    const discovered = await connected.discoverAllServicesAndCharacteristics()
    setDevice(discovered)
  }, [])

  const isConnected = useCallback(
    async () => device?.isConnected() || false,
    [device]
  )

  const disconnect = useCallback(async () => {
    if (!device) return false

    const connected = await isConnected()
    if (!connected) return false
    await device.cancelConnection()
    return true
  }, [device, isConnected])

  const findCharacteristic = useCallback(
    async (
      characteristicUuid: HotspotCharacteristic | FirmwareCharacteristic,
      service: Service = Service.MAIN_UUID
    ) => {
      if (!device) return

      const characteristics = await device.characteristicsForService(service)
      const characteristic = characteristics.find(
        (c) => c.uuid === characteristicUuid
      )
      return characteristic
    },
    [device]
  )

  const readCharacteristic = async (
    char: Characteristic
  ): Promise<Characteristic> => char.read()

  const writeCharacteristic = async (char: Characteristic, payload: Base64) =>
    char.writeWithResponse(payload)

  const findAndReadCharacteristic = useCallback(
    async (
      charUuid: HotspotCharacteristic | FirmwareCharacteristic,
      service: Service = Service.MAIN_UUID
    ) => {
      if (!device) return

      const characteristic = await findCharacteristic(charUuid, service)
      if (!characteristic) return

      const readChar = await readCharacteristic(characteristic)
      return readChar?.value || undefined
    },
    [device, findCharacteristic]
  )

  const checkDevice = useCallback(async () => {
    const connected = await isConnected()
    if (!connected || !device)
      throw new Error('There is not a connected device')
  }, [device, isConnected])

  const findAndWriteCharacteristic = useCallback(
    async (
      characteristicUuid: HotspotCharacteristic | FirmwareCharacteristic,
      payload: Base64,
      service: Service = Service.MAIN_UUID
    ) => {
      if (!device) return

      const characteristic = await findCharacteristic(
        characteristicUuid,
        service
      )
      if (!characteristic) return

      return writeCharacteristic(characteristic, payload)
    },
    [device, findCharacteristic]
  )

  const readBool = useCallback(
    async (characteristic: HotspotCharacteristic.ETHERNET_ONLINE_UUID) => {
      await checkDevice()

      const charVal = await findAndReadCharacteristic(characteristic)

      let parsedStr = false
      if (charVal) {
        parsedStr = parseChar(charVal, characteristic)
      }
      return parsedStr
    },
    [checkDevice, findAndReadCharacteristic]
  )

  const ethernetOnline = useCallback(
    () => readBool(HotspotCharacteristic.ETHERNET_ONLINE_UUID),
    [readBool]
  )

  const getState = useCallback(async () => getBleManager().state(), [])

  const enable = useCallback(async () => {
    await getBleManager().enable()
    return true
  }, [])

  const readWifiNetworks = useCallback(
    async (configured = false) => {
      await checkDevice()

      const characteristic = configured
        ? HotspotCharacteristic.WIFI_CONFIGURED_SERVICES
        : HotspotCharacteristic.AVAILABLE_SSIDS_UUID

      const charVal = await findAndReadCharacteristic(characteristic)
      if (!charVal) return

      return parseChar(charVal, characteristic)
    },
    [checkDevice, findAndReadCharacteristic]
  )

  const setWifi = useCallback(
    async (ssid: string, password: string) => {
      let subscription: Subscription | null
      const removeSubscription = () => {
        subscription?.remove()
        subscription = null
      }

      return new Promise<WifiStatusType>(async (resolve, reject) => {
        await checkDevice()

        const uuid = HotspotCharacteristic.WIFI_CONNECT_UUID
        const encoded = encodeWifiConnect(ssid, password)

        const wifiChar = await findCharacteristic(uuid)

        if (!wifiChar) return

        await writeCharacteristic(wifiChar, encoded)

        subscription = wifiChar?.monitor((error, c) => {
          if (error) {
            removeSubscription()
            reject(error)
            return
          }

          if (!c?.value) return

          const response = parseChar(c.value, uuid)
          if (response === 'connecting') return

          if (WifiStatusKeys.includes(response as WifiStatusType)) {
            resolve(response as WifiStatusType)
            return
          }

          reject('Unknown Error')
        })
      })
    },
    [checkDevice, findCharacteristic]
  )

  const removeConfiguredWifi = useCallback(
    async (name: string) => {
      await checkDevice()

      const uuid = HotspotCharacteristic.WIFI_REMOVE
      const encoded = encodeWifiRemove(name)

      const characteristic = await findAndWriteCharacteristic(uuid, encoded)

      if (!characteristic?.value) return
      const response = parseChar(characteristic.value, uuid)
      return response
    },
    [checkDevice, findAndWriteCharacteristic]
  )

  const createGatewayTxn = useCallback(
    async ({
      ownerAddress,
      payerAddress,
    }: {
      ownerAddress: string
      payerAddress: string
    }) => {
      await checkDevice()

      const { fee, stakingFee } = calculateAddGatewayFee(
        ownerAddress,
        payerAddress
      )

      const encodedPayload = encodeAddGateway(
        ownerAddress,
        stakingFee,
        fee,
        payerAddress
      )
      const addGatewayUuid = HotspotCharacteristic.ADD_GATEWAY_UUID
      const characteristic = await findCharacteristic(addGatewayUuid)

      if (!characteristic) {
        throw new Error(
          `Could not find characteristic ${HotspotCharacteristic.ADD_GATEWAY_UUID}`
        )
      }

      await writeCharacteristic(characteristic, encodedPayload)
      const { value } = await readCharacteristic(characteristic)
      if (!value) {
        throw new Error(
          `Could not read characteristic ${HotspotCharacteristic.ADD_GATEWAY_UUID}`
        )
      }

      const parsedValue = decode(value)
      if (parsedValue in HotspotErrorCode || parsedValue.length < 20) {
        throw new Error(parsedValue)
      }

      return value
    },
    [checkDevice, findCharacteristic]
  )

  const createAndSignGatewayTxn = useCallback(
    async ({
      ownerAddress,
      payerAddress,
      ownerKeypairRaw,
    }: {
      ownerAddress: string
      payerAddress: string
      ownerKeypairRaw: SodiumKeyPair
    }): Promise<AddGatewayV1 | undefined> => {
      const value = await createGatewayTxn({ ownerAddress, payerAddress })
      return signGatewayTxn(value, ownerKeypairRaw)
    },
    [createGatewayTxn]
  )

  const getDiagnosticInfo = useCallback(async () => {
    await checkDevice()

    const charVal = await findAndReadCharacteristic(
      HotspotCharacteristic.DIAGNOSTIC_UUID
    )
    if (!charVal) throw new Error('Could not read diagnostics')

    return parseChar(charVal, HotspotCharacteristic.DIAGNOSTIC_UUID)
  }, [checkDevice, findAndReadCharacteristic])

  const checkFirmwareCurrent = useCallback(
    async (minVersion: string) => {
      await checkDevice()

      const characteristic = FirmwareCharacteristic.FIRMWAREVERSION_UUID
      const charVal = await findAndReadCharacteristic(
        characteristic,
        Service.FIRMWARESERVICE_UUID
      )
      if (!charVal) throw new Error('Could not read firmware version')

      const deviceFirmwareVersion = parseChar(charVal, characteristic)

      const current = compareVersions.compare(
        deviceFirmwareVersion,
        minVersion,
        '>='
      )
      return { current, minVersion, deviceFirmwareVersion }
    },
    [checkDevice, findAndReadCharacteristic]
  )

  const getOnboardingAddress = useCallback(async () => {
    await checkDevice()

    const charVal = await findAndReadCharacteristic(
      HotspotCharacteristic.ONBOARDING_KEY_UUID
    )
    if (!charVal) throw new Error('Could not read diagnostics')

    return parseChar(charVal, HotspotCharacteristic.ONBOARDING_KEY_UUID)
  }, [checkDevice, findAndReadCharacteristic])

  return {
    startScan,
    stopScan,
    resetDevices,
    connect,
    disconnect,
    isConnected,
    getState,
    enable,
    scannedDevices,
    readWifiNetworks,
    setWifi,
    removeConfiguredWifi,
    createGatewayTxn,
    createAndSignGatewayTxn,
    ethernetOnline,
    getDiagnosticInfo,
    checkFirmwareCurrent,
    getOnboardingAddress,
  }
}

export default useHotspotBle
