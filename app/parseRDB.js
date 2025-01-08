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
  console.log(`Key: ${key}, Value: ${value}`);
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
