'use strict'

const Shake = require('it-handshake')
const lp = require('it-length-prefixed')

module.exports = (duplex, opts = {}) => {
  const shake = Shake(duplex)
  const lpReader = lp.decode.fromReader(shake.reader, { lengthDecoder: opts.lengthDecoder })

  let isDone = false

  const W = {
    read: async (bytes) => {
      // just read

      const { value, done } = await shake.reader.next(bytes)

      if (done && value.length < bytes) {
        throw new Error('Couldn\'t read enough bytes')
      }

      isDone = done

      if (!value) { throw new Error('Value is null') }
      return value
    },
    readLP: async () => {
      // read, decode
      const { value, done } = await lpReader.next()

      isDone = done

      if (!value) { throw new Error('Value is null') }
      return value
    },
    readPB: async (proto) => {
      // readLP, decode
      const { value, done } = await W.readLP()

      isDone = done

      if (!value) { throw new Error('Value is null') }
      return proto.decode(value)
    },
    write: (data) => {
      // just write
      shake.writer.push(data)
    },
    writeLP: (data) => {
      // encode, write
      W.write(lp.encode.single(data, { lengthEncoder: opts.lengthEncoder }))
    },
    writePB: (data, proto) => {
      // encode, writeLP
      W.writeLP(proto.encode(data))
    },

    pb: (proto) => {
      return {
        read: () => W.readPB(proto),
        write: (d) => W.writePB(d, proto)
      }
    },

    unwrap: () => {
      // returns vanilla duplex again, terminates all reads/writes from this object
      shake.rest()
      return shake.stream
    }
  }

  return W
}
