const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");


 const server = net.createServer((socket) => {
   // Handle connection
   socket.on('data', (data) => {
    const command = data;
     console.log(`Received command: ${command}`);

    // Example response: +PONG\r\n for PING command
    let response = "Command not recognized";
    if (command === "*1\r\n$4\r\nPING\r\n") {
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
