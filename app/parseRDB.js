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
  const keyLength = data[cursor];
  const key = data.subarray(cursor + 1, cursor + 1 + keyLength).toString();
  cursor += keyLength + 1;

  const valueLength = data[cursor];
  const value = data.subarray(cursor + 1, cursor + 1 + valueLength).toString();
  cursor += valueLength + 1;

  map2.set(key, value);
  return cursor;
}

function traversal(data) {
  const { REDIS_MAGIC_STRING, REDIS_VERSION } = redis_main_const;
  let cursor = REDIS_MAGIC_STRING + REDIS_VERSION;

  // Skip until the first SELECTDB opcode
  while (cursor < data.length && data[cursor] !== OPCODES.SELECTDB) {
    cursor++;
  }
  cursor++; // Move past SELECTDB opcode

  // Parse the rest of the RDB file
  while (cursor < data.length) {
    if (data[cursor] === OPCODES.EXPIRETIME || data[cursor] === OPCODES.EXPIRETIMEMS) {
      const expiryLength = data[cursor] === OPCODES.EXPIRETIME ? 4 : 8;
      cursor += expiryLength + 1; // Skip expiry opcode and timestamp
      cursor = processKeyValuePair(data, cursor);
    } else {
      cursor++;
    }
  }

  return map2;
}

function getKeysValues(data) {
  traversal(data); // Populate map2
  return map2;
}

module.exports = {
  getKeysValues,
};
