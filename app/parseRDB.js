const { redis_main_const, OPCODES } = require("./consts.js");

const map2 = new Map();  // Stores key-value pairs
const map3 = new Map();  // Stores key-expiryTime pairs

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

function handleExpiryTimeInSeconds(data, cursor) {
  const expiryTime = data.readUInt32BE(cursor); // 4-byte unsigned int (expiry in seconds)
  cursor += 4;
  return [expiryTime, cursor];
}

function handleExpiryTimeInMilliseconds(data, cursor) {
  const expiryTime = data.readBigUInt64BE(cursor); // 8-byte unsigned long (expiry in milliseconds)
  cursor += 8;
  return [expiryTime, cursor];
}

function handleFdAndFc(data, cursor, opcode) {
  let expiryTime;

  if (opcode === OPCODES.EXPIRETIME) {
    console.log(`Expiry time in seconds at cursor ${cursor}`);
    [expiryTime, cursor] = handleExpiryTimeInSeconds(data, cursor);
  } else if (opcode === OPCODES.EXPIRETIMEMS) {
    console.log(`Expiry time in milliseconds at cursor ${cursor}`);
    [expiryTime, cursor] = handleExpiryTimeInMilliseconds(data, cursor);
  } else {
    throw new Error(`Unexpected opcode for expiry time handling: ${opcode}`);
  }

  // Process key-value pair (no need to store value here, just key and expiry)
  const [keyLength, newCursor] = handleLengthEncoding(data, cursor);
  const key = data.subarray(newCursor, newCursor + keyLength).toString();
  cursor = newCursor + keyLength;

  map3.set(key, expiryTime);  // Store key and its expiry time in map3
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
      // Handle resizedb, but make sure you implement or remove this function
      cursor++; // Skip RESIZEDB opcode (replace with proper logic if needed)
    } else if (opcode === OPCODES.EXPIRETIME || opcode === OPCODES.EXPIRETIMEMS) {
      cursor = handleFdAndFc(data, cursor + 1, opcode); // Handle FD/FC and store in map3
    } else if (opcode === OPCODES.EOF) {
      console.log(`End of file reached at cursor ${cursor}`);
      break;
    } else {
      console.warn(`Unrecognized opcode ${opcode} at cursor ${cursor}`);
      cursor++; // Move forward to avoid infinite loop
    }
  }

  return map2; // Return both map2 (key-value pairs) and map3 (key-expiry pairs)
}

function getKeysValues(data) {
  const map2 = traversal(data); // Populate map2 and map3
  console.log("Map2 contents:", Array.from(map2.entries()));
  console.log("Map3 contents (with expiry times):", Array.from(map3.entries()));
  return map2; // Return both maps separately
}

module.exports = {
  getKeysValues,
  map3
};
