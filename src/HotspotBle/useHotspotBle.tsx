import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BleManager,
  Device,
  LogLevel,
  BleError,
  Characteristic,
  Subscription,
  Base64,
} from 'react-native-ble-plx'
import { getOnboardingRecord } from '../Staking/stakingClient'
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

export enum HotspotErrorCode {
  WAIT = 'wait',
  UNKNOWN = 'unknown',
  BAD_ARGS = 'badargs',
  ERROR = 'error',
  GATEWAY_NOT_FOUND = 'gw_not_found', // This may no longer be relevant, but it's not hurting anything check for it
}

const WifiStatusKeys = ['connected', 'invalid', 'not_found'] as const
export type WifiStatusType = typeof WifiStatusKeys[number]

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
      manager.destroy()
      instanceRef.current = null
    }
  }, [])

  const startScan = async (callback: (error: BleError | null) => void) => {
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
  }

  const stopScan = () => getBleManager().stopDeviceScan()

  const connect = async (
    hotspotDevice: Device
  ): Promise<Device | undefined> => {
    const connected = await hotspotDevice.connect({
      refreshGatt: 'OnConnected',
    })
    setDevice(connected)
    return connected
  }

  const disconnect = async () => {
    if (!device) return false

    const connected = await isConnected()
    if (!connected) return false
    await device.cancelConnection()
    return true
  }

  const isConnected = async () => {
    if (!device) return false
    return device.isConnected()
  }

  const discoverAllServicesAndCharacteristics = async () => {
    const connected = await isConnected()
    if (!connected || !device) return

    return device.discoverAllServicesAndCharacteristics()
  }

  const findCharacteristic = async (
    characteristicUuid: HotspotCharacteristic | FirmwareCharacteristic,
    service: Service = Service.MAIN_UUID
  ) => {
    if (!device) return

    const characteristics = await device.characteristicsForService(service)
    const characteristic = characteristics.find(
      (c) => c.uuid === characteristicUuid
    )
    return characteristic
  }

  const readCharacteristic = async (
    char: Characteristic
  ): Promise<Characteristic> => char.read()

  const writeCharacteristic = async (char: Characteristic, payload: Base64) =>
    char.writeWithResponse(payload)

  const findAndReadCharacteristic = async (
    charUuid: HotspotCharacteristic | FirmwareCharacteristic,
    service: Service = Service.MAIN_UUID
  ) => {
    if (!device) return

    const characteristic = await findCharacteristic(charUuid, service)
    if (!characteristic) return

    const readChar = await readCharacteristic(characteristic)
    return readChar?.value || undefined
  }

  const checkDevice = async () => {
    const connected = await isConnected()
    if (!connected || !device) throw new Error('There is not connected device')
  }

  const findAndWriteCharacteristic = async (
    characteristicUuid: HotspotCharacteristic | FirmwareCharacteristic,
    payload: Base64,
    service: Service = Service.MAIN_UUID
  ) => {
    if (!device) return

    const characteristic = await findCharacteristic(characteristicUuid, service)
    if (!characteristic) return

    return writeCharacteristic(characteristic, payload)
  }

  const readString = async (
    characteristic:
      | HotspotCharacteristic.WIFI_SSID_UUID
      | HotspotCharacteristic.PUBKEY_UUID
      | HotspotCharacteristic.ONBOARDING_KEY_UUID
  ) => {
    await checkDevice()

    const charVal = await findAndReadCharacteristic(characteristic)

    let parsedStr = ''
    if (charVal) {
      parsedStr = parseChar(charVal, characteristic)
    }
    return parsedStr
  }

  const readBool = async (
    characteristic: HotspotCharacteristic.ETHERNET_ONLINE_UUID
  ) => {
    await checkDevice()

    const charVal = await findAndReadCharacteristic(characteristic)

    let parsedStr = false
    if (charVal) {
      parsedStr = parseChar(charVal, characteristic)
    }
    return parsedStr
  }

  const ethernetOnline = () =>
    readBool(HotspotCharacteristic.ETHERNET_ONLINE_UUID)

  const getState = async () => getBleManager().state()

  const enable = async () => {
    await getBleManager().enable()
    return true
  }

  const readWifiNetworks = async (configured = false) => {
    await checkDevice()

    const characteristic = configured
      ? HotspotCharacteristic.WIFI_CONFIGURED_SERVICES
      : HotspotCharacteristic.AVAILABLE_SSIDS_UUID

    const charVal = await findAndReadCharacteristic(characteristic)
    if (!charVal) return

    return parseChar(charVal, characteristic)
  }

  const setWifi = async (ssid: string, password: string) => {
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
  }

  const removeConfiguredWifi = async (name: string) => {
    checkDevice()

    const uuid = HotspotCharacteristic.WIFI_REMOVE
    const encoded = encodeWifiRemove(name)

    const characteristic = await findAndWriteCharacteristic(uuid, encoded)

    if (!characteristic?.value) return
    const response = parseChar(characteristic.value, uuid)
    return response
  }

  const createGatewayTxn = async (
    ownerAddress: string,
    ownerKeypairRaw: SodiumKeyPair
  ) => {
    checkDevice()

    const onboardingAddress = await readString(
      HotspotCharacteristic.ONBOARDING_KEY_UUID
    )
    const onboardingRecord = await getOnboardingRecord(onboardingAddress)

    const payer = onboardingRecord.maker.address
    const { fee, stakingFee } = calculateAddGatewayFee(ownerAddress, payer)

    const encodedPayload = encodeAddGateway(
      ownerAddress,
      stakingFee,
      fee,
      payer
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

    return signGatewayTxn(value, ownerKeypairRaw)
  }

  return {
    startScan,
    stopScan,
    connect,
    disconnect,
    isConnected,
    discoverAllServicesAndCharacteristics,
    getState,
    enable,
    scannedDevices,
    readWifiNetworks,
    setWifi,
    removeConfiguredWifi,
    createGatewayTxn,
    ethernetOnline,
  }
}

export default useHotspotBle
