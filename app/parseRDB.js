const { redis_main_const, OPCODES } = require("./consts.js");

const map2 = new Map();

function handleLengthEncoding(data, cursor) {
  const byte = data[cursor];
  const type = (byte & 0b11000000) >> 6;

  if (type === 0b00) {
    return [byte & 0b00111111, cursor + 1]; // 6-bit length
  } else if (type === 0b01) {
    return [(byte & 0b00111111) << 8 | data[cursor + 1], cursor + 2]; // 14-bit length
  } else if (type === 0b10) {
    return [data.readUInt32BE(cursor + 1), cursor + 5]; // 32-bit length
  } else {
    throw new Error(`Unsupported encoding at cursor ${cursor}`);
  }
}

function processKeyValuePair(data, cursor) {
  const [keyLength, newCursor] = handleLengthEncoding(data, cursor);
  if (cursor + keyLength > data.length) {
    throw new Error(`Key length exceeds buffer size at cursor ${cursor}`);
  }

  const key = data.subarray(newCursor, newCursor + keyLength).toString();
  cursor = newCursor + keyLength;

  const [valueLength, valueCursor] = handleLengthEncoding(data, cursor);
  if (cursor + valueLength > data.length) {
    throw new Error(`Value length exceeds buffer size at cursor ${cursor}`);
  }

  const value = data.subarray(valueCursor, valueCursor + valueLength).toString();
  cursor = valueCursor + valueLength;

  console.log(`Parsed Key: ${key}, Value: ${value}`);
  map2.set(key, value);
  return cursor;
}

function handleResizedb(data, cursor) {
  // Read the $length-encoded int for hash table size
  const [hashTableSize, newCursor] = handleLengthEncoding(data, cursor);
  cursor = newCursor;

  // Read the $length-encoded int for expire hash table size
  const [expireTableSize, expireCursor] = handleLengthEncoding(data, cursor);
  cursor = expireCursor;

  console.log(`Resized DB: Hash Table Size = ${hashTableSize}, Expire Table Size = ${expireTableSize}`);

  // Now read each key-value pair
  for (let i = 0; i < hashTableSize; i++) {
    const valueType = data[cursor]; // 1 byte indicating the value type
    cursor += 1; // Move past the value-type byte

    // Now process key-value pair based on value type
    cursor = processKeyValuePair(data, cursor);
  }

  return cursor;
}

function traversal(data) {
  let cursor = 9; // Skip header ("REDIS0011")

  while (cursor < data.length) {
    const opcode = data[cursor];

    if (opcode === OPCODES.SELECTDB) {
      console.log(`Switching to new database at cursor ${cursor}`);
      cursor++; // Skip SELECTDB opcode
      const [dbIndex, newCursor] = handleLengthEncoding(data, cursor);
      cursor = newCursor;
      console.log(`Switched to DB ${dbIndex}`);
    } else if (opcode === OPCODES.RESIZEDB) {
      cursor = handleResizedb(data, cursor + 1); // Skip opcode and process resizedb
    } else if (opcode === OPCODES.EOF) {
      console.log(`End of file reached at cursor ${cursor}`);
      break;
    } else {
      console.warn(`Unrecognized opcode ${opcode} at cursor ${cursor}`);
      cursor++; // Move forward to avoid infinite loop
    }
  }

  return map2;
}

function getKeysValues(data) {
  traversal(data); // Populate map2
  console.log("Map contents:", Array.from(map2.entries()));
  return map2;
}

module.exports = {
  getKeysValues,
};
