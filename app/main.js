const net = require("net");
const fs = require("fs");
const path = require("path");
const { getKeysValues } = require("./parseRDB.js");
 // Load your RDB file


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
let y=new Map();
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
     let {m1,m2} = getKeysValues(rdb);
     map1=m1;
     y=m2;
      console.log(`Successfully read RDB file: ${dbPath}`);
    } catch (error) {
      console.error(`Error reading DB at provided path: ${dbPath}`);
    }
  } else {
    console.log(`DB doesn't exist at provided path: ${dbPath}`);
  }
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
      console.log(`balle`);
      let currentTimestamp = Date.now();
      if (map1.has(command[4])){
        console.log('Map3 (Key-ExpiryTime):', y);
       if(y.has(command[4])){
        console.log(`Key "${y.get(command[4])}"`)
        if(y.get(command[4]) >= currentTimestamp){connection.write(serializeRESP(map1.get(command[4])));}
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
     // Get all keys from map1
  const keys = Array.from(map1.keys());

  // Serialize keys into RESP format
  const respKeys = `*${keys.length}\r\n` + keys.map(key => `$${key.length}\r\n${key}\r\n`).join('');

  // Send the serialized response
  connection.write(respKeys);
    } else {
      connection.write(serializeRESP("ERR unknown command"));
    }
  });
});

server.listen(6379, "127.0.0.1");
