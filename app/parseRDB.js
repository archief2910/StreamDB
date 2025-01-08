const { redis_main_const, OPCODES } = require("./consts.js");

const map2 = new Map();

function handleLengthEncoding(data, cursor) {
  const byte = data[cursor];
  const lengthType = (byte & 0b11000000) >> 6;
  const lengthValues = [
    [byte & 0b00111111, cursor + 1],
    [(byte & 0b00111111) << 8 | data[cursor + 1], cursor + 2],
    [data.readUInt32BE(cursor + 1), cursor + 5],
  ];
  return (
    lengthValues[lengthType] || new Error(`Invalid length encoding ${lengthType} at ${cursor}`)
  );
}
function processKeyValuePair(data, cursor) {
  // Parse key length
  const [keyLength, newCursor] = handleLengthEncoding(data, cursor);
  cursor = newCursor;

  // Validate key length
  if (cursor + keyLength > data.length) {
    throw new Error(`Invalid key length at cursor ${cursor}`);
  }

  // Extract key
  const key = data.subarray(cursor, cursor + keyLength).toString();
  cursor += keyLength;

  // Parse value length
  const [valueLength, updatedCursor] = handleLengthEncoding(data, cursor);
  cursor = updatedCursor;

  // Validate value length
  if (cursor + valueLength > data.length) {
    throw new Error(`Invalid value length at cursor ${cursor}`);
  }

  // Extract value
  const value = data.subarray(cursor, cursor + valueLength).toString();
  cursor += valueLength;

  // Debugging output
  console.log(`Key: ${key}, Value: ${value}`);

  // Store in the map
  map2.set(key, value);

  return cursor;
}

function traversal(data) {
  console.log("Starting traversal");
  const { REDIS_MAGIC_STRING, REDIS_VERSION } = redis_main_const;
  let cursor = REDIS_MAGIC_STRING + REDIS_VERSION;

  while (cursor < data.length && data[cursor] !== OPCODES.SELECTDB) {
    console.log(`Skipping byte at cursor ${cursor}`);
    cursor++;
  }
  cursor++;

  while (cursor < data.length) {
    console.log(`Parsing at cursor ${cursor}`);
    if (data[cursor] === OPCODES.EXPIRETIME || data[cursor] === OPCODES.EXPIRETIMEMS) {
      console.log("Found expiry opcode");
      const expiryLength = data[cursor] === OPCODES.EXPIRETIME ? 4 : 8;
      cursor += expiryLength + 1;
      cursor = processKeyValuePair(data, cursor);
    } else {
      cursor++;
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
