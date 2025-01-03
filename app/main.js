const net = require("net");
const fs = require("fs");
const path = require("path");
const { getKeysValues } = require("./parseRDB.js");

let rdb = null; // Initialize RDB to null
const map1 = new Map();
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
      connection.write("+PONG\r\n");
    } else if (command[2] === "ECHO") {
      const str = command[4];
      const l = str.length;
      connection.write("$" + l + "\r\n" + str + "\r\n");
    } else if (command[2] === "SET") {
      map1.set(command[4], command[6]); // Set the key-value pair in the map

      if (command.length >= 8 && command[8] === "px") {
        let interval = parseInt(command[10], 10);
        let start = Date.now(); // Record the start time

        function accurateTimeout() {
          let elapsed = Date.now() - start;

          if (elapsed >= interval) {
            map1.delete(command[4]); // Delete the key after the interval
            console.log(`Key "${command[4]}" deleted after ${interval} ms`);
          } else {
            // Adjust timeout for the drift
            setTimeout(accurateTimeout, interval - elapsed);
          }
        }

        // Start the recursive timeout
        setTimeout(accurateTimeout, interval);
      }

      connection.write("+OK\r\n");
    } else if (command[2] === "GET") {
      if (map1.has(command[4])) {
        connection.write(
          `$${map1.get(command[4]).length}\r\n${map1.get(command[4])}\r\n`
        );
      } else {
        connection.write("$-1\r\n");
      }
    } else if (command[2] === "CONFIG" && command[4] === "GET") {
      if (addr.has(command[6])) {
        connection.write(
          "*2" +
            "\r\n" +
            "$" +
            command[6].length +
            "\r\n" +
            command[6] +
            "\r\n" +
            "$" +
            addr.get(command[6]).length +
            "\r\n" +
            addr.get(command[6]) +
            "\r\n"
        );
      } else {
        connection.write("$-1\r\n");
      }
    } else if (command[2] === "KEYS") {
      if (rdb) {
        try {
          const key = getKeysValues(rdb); // Use the RDB parsing logic
          if (key) {
            connection.write(`*1\r\n$${key.length}\r\n${key}\r\n`);
          } else {
            connection.write("*0\r\n");
          }
        } catch (error) {
          console.error("Error parsing RDB file:", error);
          connection.write("*0\r\n");
        }
      } else {
        connection.write("*0\r\n"); // Empty database response
      }
    }
  });
});

server.listen(6379, "127.0.0.1");
