const net = require("net");

// Create a server
const server = net.createServer((socket) => {
  let buffer = ""; // To accumulate incoming data

  socket.on("data", (data) => {
    buffer += data.toString(); // Append data to the buffer

    // Check if the buffer contains the complete command
    if (buffer.includes("\r\n")) {
      console.log(`Received complete command: ${buffer.trim()}`);

      // Check if the command is exactly *1\r\n$4\r\nPING\r\n
      if (buffer === "*1\r\n$4\r\nPING\r\n") {
        socket.write("+PONG\r\n"); // Send the Redis PONG response
      } else {
        socket.write("-Error: Command not recognized\r\n"); // Send error response for unknown commands
      }

      buffer = ""; // Clear the buffer after processing
    }
  });

  socket.on("error", (err) => {
    console.error(err);
  });
});

// Listen on Redis default port
server.listen(6379, "127.0.0.1", () => {
  console.log("Redis-like server is running on 127.0.0.1:6379");
});
