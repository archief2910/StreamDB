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
  let cursor = 9; // Skip the 5-byte magic string and 4-byte version

  while (cursor < data.length) {
    const opcode = data[cursor];
    console.log(`Parsing at cursor ${cursor}, opcode: 0x${opcode.toString(16)}`);

    switch (opcode) {
      case 0xFA: // Auxiliary field
        console.log("Found auxiliary field");
        cursor++; // Move past `FA`
        cursor = processKeyValuePair(data, cursor);
        break;

      case 0xFE: // Database selector
        console.log("Found database selector");
        cursor += 2; // Move past `FE` and db number (1 byte)
        break;

      case 0xFB: // Resizedb field
        console.log("Found resizedb field");
        cursor++; // Move past `FB`
        cursor = handleLengthEncoding(data, cursor)[1]; // Skip first length
        cursor = handleLengthEncoding(data, cursor)[1]; // Skip second length
        break;

      case 0xFD: // Expiry time in seconds
      case 0xFC: // Expiry time in milliseconds
        console.log(`Found expiry time opcode: ${opcode === 0xFD ? "seconds" : "milliseconds"}`);
        const expiryLength = opcode === 0xFD ? 4 : 8;
        cursor += expiryLength + 1; // Skip expiry time and move to the next opcode
        cursor = processKeyValuePair(data, cursor); // Parse key-value pair
        break;

      case 0xFF: // End of RDB file
        console.log("End of RDB file reached");
        cursor += 9; // Move past the 8-byte checksum
        return map2;

      default: // Key-value pair without expiry
        console.log("Found key-value pair without expiry");
        cursor++;
        cursor = processKeyValuePair(data, cursor);
        break;
    }
  }

  throw new Error("Unexpected end of data without RDB file end marker");
}

function getKeysValues(data) {
  traversal(data); // Populate map2
  console.log("Map contents:", Array.from(map2.entries()));
  return map2;
}

module.exports = {
  getKeysValues,
};
