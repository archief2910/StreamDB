const replicaConnections = new Map();
const availableReplicas = new Map();
let timeout=0;
let offset=0;
function parseCommandChunks(data) {
  let currentIndex = 0; // start at the beginning of the data string
  const commandChunks = []; // this will store each parsed command chunk
  // loop throught the entire string to find all command chunks
  while (currentIndex < data.length) {
    // find the start index of the next command, indicated by '*'
    const nextCommandStart = data.indexOf('*', currentIndex + 1);
    // determine the end of the current chunk: either the start of the next command chunk or the end of the data
    const currentChunkEnd = nextCommandStart === -1 ? data.length : nextCommandStart;
    // extract the command chunk from currentIndex to the determined end
    if (currentIndex !== currentChunkEnd) { // ensure that we do no include empty command
      commandChunks.push(data.substring(currentIndex, currentChunkEnd));
    }
    // move the currentIndex to the start of the next command
    // if no next command, break the loop by setting currentIndex to data.length
    currentIndex = nextCommandStart === -1 ? data.length : nextCommandStart;
  }
  return commandChunks;
}
function broadcastToReplicas(replicaConnections, message) {
  replicaConnections.forEach((conn, address) => {
    try {
      conn.write(message);
      console.log(`Message sent to replica: ${address} - ${message}`);
    } catch (error) {
      console.error(`Failed to send message to ${address}:`, error);
    }
  });
}

function broadcastToReplicasWithTimeout(replicaConnections, availableReplicas, offset, timeout, callback) {
  let y1 = 0;
  let timeElapsed = 0;

  const interval = setInterval(() => {
    replicaConnections.forEach((conn, address) => {
      try {
        if (availableReplicas[address] === offset) {
          y1++;
          console.log(`Message sent to replica: ${address}`);
        }
      } catch (error) {
        console.error(`Failed to process replica ${address}:`, error);
      }
    });

    timeElapsed += timeout;

    if (timeElapsed >= timeout) {
      clearInterval(interval);
      console.log(`Number of successful operations: ${y1}`);
      callback(y1);
    }
  }, timeout);
}
const serializeRESP = (obj) => {
  let resp = '';
  switch (typeof obj) {
    case 'object':
      if (Array.isArray(obj)) {
        resp += `*${obj.length}\r\n`;
        obj.forEach(item => {
          resp += serializeRESP(item);
        });
      } else if (obj === null) {
        resp += `$-1\r\n`;
      }
      break;
    case 'string':
      resp += `$${obj.length}\r\n${obj}\r\n`;
      break;
    case 'number':
      resp += `:${obj}\r\n`;
      break;
    case 'boolean':
      resp += obj ? `+OK\r\n` : `-ERR false\r\n`;
      break;
    default:
      resp += `$-1\r\n`;
  }
  return resp;
};
module.exports = {
  broadcastToReplicas,broadcastToReplicasWithTimeout,parseCommandChunks,serializeRESP,
};

