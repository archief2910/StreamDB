const net = require("net");
const fs = require("fs");
const path = require("path");
const { getKeysValues,h } = require("./parseRDB.js");
 // Load your RDB file
 const portIdx = process.argv.indexOf("--port");
 const replicaidx = process.argv.indexOf("--replicaof");
 const PORT = portIdx == -1 ? 6379 : process.argv[portIdx + 1]
 const masterString = replicaidx == -1 ? "" : process.argv[replicaidx + 1]
 const masterArray = masterString.split(" ")
 const replicaConnections = new Map();
 function broadcastToReplicas(message) {
  replicaConnections.forEach((conn, address) => {
      try {
          conn.write(message);
          console.log(`Message sent to replica: ${address}`);
      } catch (error) {
          console.error(`Failed to send message to ${address}:`, error);
      }
  });
}
function broadcastToReplicasWithTimeout(message, timeout, y) {
  const replicaStatus = new Map();
  let successfulReplicas = 0;

  const checkAndReturn = () => {
      if (successfulReplicas === y) {
          clearTimeout(globalTimeout);
          return successfulReplicas;
      }
  };

  replicaConnections.forEach((conn, address) => {
      replicaStatus.set(address, false);

      try {
          // Set timeout for each connection
          const timer = setTimeout(() => {
              try {
                  conn.write(message);
                  console.log(`Message sent to replica: ${address}`);
                  replicaStatus.set(address, true);
                  successfulReplicas++;
                  checkAndReturn(); // Check after every successful replica
              } catch (error) {
                  console.error(`Failed to send message to ${address}:`, error);
              }
          }, timeout);

          conn.on('error', (error) => {
              clearTimeout(timer);
              console.error(`Connection error for ${address}:`, error);
          });
      } catch (error) {
          console.error(`Failed to schedule message to ${address}:`, error);
      }
  });

  // Final fallback after timeout
  const globalTimeout = setTimeout(() => {
      console.log('Timeout reached. Returning successful replicas.');
  }, timeout);

  // Return the count synchronously (after handling)
  return successfulReplicas;
}

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
 // Logs the Map with key-value pairs
// Function to serialize data into RESP format
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
let rdb = null; // Initialize RDB to null
let map1=new Map();
let map3 = new Map();
const addr = new Map();
const arguments = process.argv.slice(2);
const [fileDir, fileName] = [arguments[1] ?? null, arguments[3] ?? null];
// Set file directory and name
if (fileDir && fileName) {
  addr.set("dir", fileDir);
  addr.set("dbfilename", fileName);
}
if (addr.get("dir") && addr.get("dbfilename")) {
  const dbPath = path.join(addr.get("dir"), addr.get("dbfilename"));
  const isDbExists = fs.existsSync(dbPath);
  if (isDbExists) {
    try {
      rdb = fs.readFileSync(dbPath);
      map1 = getKeysValues(rdb);
      map3= h(rdb);
      console.log(` ${map3}`); console.log(` ${map1}`);
      console.log(`Successfully read RDB file: ${dbPath}`);
    } catch (error) {
      console.error(`Error reading DB at provided path: ${dbPath}`);
    }
  } else {
    console.log(`DB doesn't exist at provided path: ${dbPath}`);
  }
}
if (replicaidx !== -1) {
  const performHandshake = () => {
    const [host, port] = masterArray; // Extract host and port
    let handshakeState = 1;
    let processedOffset = 0;

    const client = net.createConnection({ host, port }, () => {
      console.log(`Connected to master server: ${host} on port: ${port}`);
    });

    client.setEncoding('utf8');

    // Start the handshake by sending PING
    client.write(generateRespArrayMsg(['PING']));

    client.on('data', (event) => {
      if (typeof event !== 'string') {
        console.error('Invalid data received:', event);
        return;
      }

      try {
        switch (handshakeState) {
          case 1:
            handshakeState = 2;
            client.write(generateRespArrayMsg(['REPLCONF', 'listening-port', `${PORT}`]));
            console.log("PING acknowledged");
            break;
          case 2:
            handshakeState = 3;
            client.write(generateRespArrayMsg(['REPLCONF', 'capa', 'psync2']));
            console.log("REPLCONF listening-port acknowledged");
            break;
          case 3:
            handshakeState = 4;
            client.write(generateRespArrayMsg(['PSYNC', '?', '-1']));
            console.log("REPLCONF capa acknowledged");
            break;
          default:
            const commands = parseCommandChunks(event.toString());
            commands.forEach((request) => {
              console.log(`${request} lola`);
              let command = Buffer.from(request).toString().split("\r\n");
          
              // Calculate the RESP-encoded length of the command
              const calculateRespLength = (resp) => Buffer.byteLength(resp, 'utf8');
          
              if (command[2] === 'SET') {
                map1.set(command[4], command[6]);
          
                // Handle expiration (if specified)
                if (command.length >= 8 && command[8] === 'px') {
                  const interval = parseInt(command[10], 10);
                  setTimeout(() => {
                    map1.delete(command[4]);
                    console.log(`Key "${command[4]}" deleted after ${interval} ms`);
                  }, interval);
                }
          
                // Add the RESP length of the SET command
                processedOffset += calculateRespLength(request);
              } else if (command[2] === 'PING') {
                // Add the RESP length of the PING command
                processedOffset += calculateRespLength(request);
              } else if (command[2] === 'REPLCONF' && command[4] === 'GETACK') {
                // Generate the acknowledgment response
                const ackCommand = generateRespArrayMsg(['REPLCONF', 'ACK', `${processedOffset}`]);
                processedOffset += 3;
                client.write(ackCommand);
          
                // Add the RESP length of the REPLCONF GETACK command
                processedOffset += calculateRespLength(request);
              }
            });
        }
      } catch (error) {
        console.error('Error processing data:', error.message);
      }
    });

    client.on('error', (err) => {
      console.error('Client connection error:', err.message);
    });

    client.on('close', () => {
      console.log('Connection to master server closed.');
    });
  };

  const generateRespArrayMsg = (args) => {
    if (!Array.isArray(args)) throw new Error('Invalid arguments for RESP array');
    return `*${args.length}\r\n${args.map((arg) => `$${arg.length}\r\n${arg}\r\n`).join('')}`;
  };

  performHandshake(); // Trigger handshake
}


const server = net.createServer((connection) => {
  console.log("Client connected");
  connection.on("data", (data) => {
    console.log("Received:", data);
    const command = Buffer.from(data).toString().split("\r\n");
    if (command[2] === "PING") {
      connection.write(serializeRESP("PONG"));
    } else if (command[2] === "ECHO") {
      const str = command[4];
      connection.write(serializeRESP(str));
    } else if (command[2] === "SET") {
      broadcastToReplicas(data);
      map1.set(command[4], command[6]);
      if (command.length >= 8 && command[8] === "px") {
        let interval = parseInt(command[10], 10);
        let start = Date.now();
        function accurateTimeout() {
          let elapsed = Date.now() - start;
          if (elapsed >= interval) {
            map1.delete(command[4]);
            console.log(`Key "${command[4]}" deleted after ${interval} ms`);
          } else {
            setTimeout(accurateTimeout, interval - elapsed);
          }
        }
        setTimeout(accurateTimeout, interval);
      }
      broadcastToReplicas(serializeRESP(["REPLCONF","GETACK","*"]));
      connection.write(serializeRESP(true));
    } else if (command[2] === "GET") {
      broadcastToReplicas(data);
      console.log(`balle`);
      let currentTimestamp = Date.now();
      if (map1.has(command[4])){
        console.log('Map3 (Key-ExpiryTime):', map3);
       if(map3.has(command[4])){
        console.log(`Key "${map3.get(command[4])}"`)
        if(map3.get(command[4]) >= currentTimestamp){connection.write(serializeRESP(map1.get(command[4])));}
        else{connection.write(serializeRESP(null));}
       } 
       else{connection.write(serializeRESP(map1.get(command[4])));}
      } else {
        connection.write(serializeRESP(null));
      }
    } else if (command[2] === "CONFIG" && command[4] === "GET") {
      if (addr.has(command[6])) {
        connection.write(
          serializeRESP([command[6], addr.get(command[6])])
        );
      } else {
        connection.write(serializeRESP(null));
      }
    } else if (command[2] === "KEYS") {
      broadcastToReplicas(data);
     // Get all keys from map1
  const keys = Array.from(map1.keys());
  // Serialize keys into RESP format
  const respKeys = `*${keys.length}\r\n` + keys.map(key => `$${key.length}\r\n${key}\r\n`).join('');
  // Send the serialized response
  connection.write(respKeys);
    }else if (command[2] === "INFO") {
      if (replicaidx !== -1) {
        connection.write(serializeRESP("role:slave"));
      } else {
        // Construct the bulk string response for the INFO command
        const info = [
          "role:master",
          "master_repl_offset:0",
          "master_replid:8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb"
        ].join("\r\n"); // Combine lines with \r\n
        
        // Send the bulk string response
        connection.write(`$${info.length}\r\n${info}\r\n`);
      }
    } else if (command[2] === "REPLCONF" && command[4] === "listening-port" && replicaidx ===-1) {
      connection.write("+OK\r\n");
    } else if (command[2] === "REPLCONF" && command[4] === "capa"  && replicaidx ===-1) {
      connection.write("+OK\r\n");
    } else if (command[2] === "PSYNC" && command[4] === "?" && command[6] === "-1"   && replicaidx ===-1) {
      const clientAddress = `${connection.remoteAddress}:${connection.remotePort}`;
      if (!replicaConnections.has(clientAddress)) {
          replicaConnections.set(clientAddress, connection);
          console.log(`Replica added: ${clientAddress}`);
      }
      const base64 = "UkVESVMwMDEx+glyZWRpcy12ZXIFNy4yLjD6CnJlZGlzLWJpdHPAQPoFY3RpbWXCbQi8ZfoIdXNlZC1tZW3CsMQQAPoIYW9mLWJhc2XAAP/wbjv+wP9aog=="
      const rdbBuffer = Buffer.from(base64, "base64");
      const rdbHead = Buffer.from(`$${rdbBuffer.length}\r\n`)
      
   
      connection.write("+FULLRESYNC 8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb 0\r\n");
      connection.write(Buffer.concat([rdbHead, rdbBuffer]));
    } else if(command[2]=="WAIT"){
      console.log(`ankit jaldi kar ${data} `);
      const timeout = parseInt(command[6], 10); // Timeout in milliseconds
const y = parseInt(command[4], 10); // Number of replicas to check
const successfulReplicas = broadcastToReplicasWithTimeout(data, timeout, y);
console.log(`The number of successful replicas is: ${successfulReplicas}`);
      connection.write(serializeRESP(successfulReplicas));
    }
     else {
      connection.write(serializeRESP("ERR unknown command"));
    }
  });
});
server.listen(PORT, "127.0.0.1");