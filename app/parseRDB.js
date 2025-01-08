const { redis_main_const, OPCODES } = require("./consts.js");

const map2 = new Map();
const map3 = new Map();

// Utility function to handle length encoding
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

// Function to decode the key using the correct encoding method
function handleStringEncoding(data, cursor) {
  const [keyLength, newCursor] = handleLengthEncoding(data, cursor);
  const key = data.subarray(newCursor, newCursor + keyLength).toString();
  return [key, newCursor + keyLength];
}

// Function to process each key-value pair
function processKeyValuePair(data, cursor) {
  const [key, newCursor] = handleStringEncoding(data, cursor);
  cursor = newCursor;

  const valueType = data[cursor]; // 1 byte indicating the value type
  cursor += 1; // Move past value-type byte

  const [valueLength, valueCursor] = handleLengthEncoding(data, cursor);
  cursor = valueCursor + valueLength;

  console.log(`Parsed Key: ${key}, Value Type: ${valueType}`);
  map2.set(key, valueType);  // Store value type or modify as needed
  return cursor;
}

// Function to handle Resizedb operation
function handleResizedb(data, cursor) {
  // Read the $length-encoded int for hash table size
  const [hashTableSize, newCursor] = handleLengthEncoding(data, cursor);
  cursor = newCursor;

  // Read the $length-encoded int for expire hash table size
  const [expireTableSize, expireCursor] = handleLengthEncoding(data, cursor);
  cursor = expireCursor;

  console.log(`Resized DB: Hash Table Size = ${hashTableSize}, Expire Table Size = ${expireTableSize}`);

  // Initialize map3 to store key-expiry time pairs
  const map3 = new Map();

  // Now read each key-value pair and its possible expiry time
  for (let i = 0; i < hashTableSize; i++) {
    let expiryTime = null;

    // Check for expiry time formats (FD/FC)
    if (data[cursor] === 0xFD) {
      // FD format: expiry time in seconds (4 bytes unsigned int)
      cursor += 1; // Move past FD byte
      expiryTime = data.readUInt32LE(cursor); // Read 4-byte unsigned int
      cursor += 4;
    } else if (data[cursor] === 0xFC) {
      // FC format: expiry time in milliseconds (8 bytes unsigned long)
      cursor += 1; // Move past FC byte
      expiryTime = data.readUIntLE(cursor, 8); // Read 8-byte unsigned long
      cursor += 8;
    }

    // Process the key-value pair
    cursor = processKeyValuePair(data, cursor);

    // Store the key and its expiry time in map3 if expiry time is present
    if (expiryTime !== null) {
      const key = data.subarray(cursor - 1).toString();  // Assuming key is the last processed element
      map3.set(key, expiryTime);
    }
  }

  console.log('Map3 (Key-ExpiryTime):', map3);
  return cursor;
}

// Main traversal function to parse RDB file
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

// Function to get keys and values from the RDB
function getKeysValues(data) {
  traversal(data); // Populate map2 with key-value pairs
  console.log("Map contents:", Array.from(map2.entries()));
  return map2;
}

module.exports = {
  getKeysValues,
  map3, // Expose map3 for further use if needed
};
