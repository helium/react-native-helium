import buffer from 'buffer'
import 'text-encoding-polyfill'
import 'react-native-get-random-values'

global.Buffer = global.Buffer || buffer.Buffer
global.process.version = []
global.document = {
  addEventListener: () => {},
}
