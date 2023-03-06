import buffer from 'buffer'
import 'text-encoding-polyfill'
import 'react-native-get-random-values'
import '@azure/core-asynciterator-polyfill'

global.Buffer = global.Buffer || buffer.Buffer
global.process.version = []
global.document = {
  addEventListener: () => {},
}
