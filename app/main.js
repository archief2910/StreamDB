const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");


 const server = net.createServer((socket) => {
   // Handle connection
   socket.on('data', (data) => {
    const command = data.toString().trim();

    let response = "Command not recognized";
    if (command === "redis-cli PING") {
      response = "+PONG\r";
    } 

    socket.write(response + '\n');
  });

  socket.on('error', (err) => {
    console.error(err);
  });
});
//
server.listen(6379, "127.0.0.1");
