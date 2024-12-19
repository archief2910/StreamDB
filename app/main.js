const net = require("net");

// Create a server
const server = net.createServer((socket) => {
  let buffer = ""; // To accumulate incoming data

  socket.on("data", (data) => {
    buffer += data.toString(); // Append data to the buffer
    const parts = buffer.split("\r\n");
      let t=parts[0].substring(1);
       let t1=parseInt(t, 10);
       while(t1--){
        if (parts[2] === "PING") {
          socket.write("+PONG\r\n"); // Send the Redis PONG response
        } else {
          socket.write("-Error: Command not recognized\r\n"); // Send error response for unknown commands
        }
       }
     

      buffer = ""; // Clear the buffer after processing
    
  });

  socket.on("error", (err) => {
    console.error(err);
  });
});

// Listen on Redis default port
server.listen(6379, "127.0.0.1", () => {
  console.log("Redis-like server is running on 127.0.0.1:6379");
});
