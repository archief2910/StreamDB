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

if(replicaidx !==-1) {

const master = net.createConnection({ host: masterArray[0], port: masterArray[1] }, () => {
  console.log("Connected to the master server");

  // Send PING
  sendCommand("*1\r\n$4\r\nPING\r\n", "+PONG\r\n", () => {
    console.log("PING acknowledged");

    // Send REPLCONF listening-port
    sendCommand(`*3\r\n$8\r\nREPLCONF\r\n$14\r\nlistening-port\r\n$${PORT.length}\r\n${PORT}\r\n`, "+OK\r\n", () => {
      console.log("REPLCONF listening-port acknowledged");

      // Send REPLCONF capa eof capa psync2
      sendCommand(`*3\r\n$8\r\nREPLCONF\r\n$4\r\ncapa\r\n$6\r\npsync2\r\n`, "+OK\r\n", () => {
        console.log("REPLCONF capa acknowledged");

        // Send PSYNC ? -1
        sendCommand("*3\r\n$5\r\nPSYNC\r\n$1\r\n?\r\n$2\r\n-1\r\n", "+FULLRESYNC", () => {
          console.log("PSYNC acknowledged");
          master.end();
        });
      });
    });
  });
});

// Helper function to send a command and wait for acknowledgment
function sendCommand(command, expectedResponse, callback) {
  master.write(command);
  master.once("data", (data) => {
    const response = data.toString();
    console.log("Received:", response.trim());
    if (response.startsWith(expectedResponse)) {
      callback();
    } else {
      console.error("Unexpected response:", response.trim());
    }
  });
}

// Handle errors
master.on("error", (err) => {
  console.error("Connection error:", err.message);
});

master.on("end", () => {
  console.log("Disconnected from the master server");
});

}
const server = net.createServer((connection) => {
  console.log("Client connected");

  connection.on("data", (data) => {
   
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
    }
     else {
      connection.write(serializeRESP("ERR unknown command"));
    }
  });
});

server.listen(PORT, "127.0.0.1");
