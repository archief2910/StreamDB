const net = require("net");
// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");
const map1 = new Map();
const addr =new Map();
const arguments = process.argv.slice(2);
const [fileDir, fileName] = [arguments[1] ?? null, arguments[3] ?? null];
if (fileDir && fileName) {
	addr.set('dir', fileDir);
	addr.set('dbfilename', fileName);
}
const server = net.createServer((connection) => {
  console.log('Client connected');
  
  connection.on('data', (data) => {
    const command = Buffer.from(data).toString().split("\r\n");
    
    if (command[2] === 'PING') {
      connection.write('+PONG\r\n');
    }
    else if (command[2] === 'ECHO') {
      const str = command[4];
      const l = str.length;
      return connection.write("$" + l + "\r\n" + str + "\r\n");
    }
    else if (command[2] === 'SET') {
      map1.set(command[4], command[6]); // Set the key-value pair in the map
    
      if (command.length >= 8 && command[8] === 'px') {
        let interval = parseInt(command[10], 10);
        let start = Date.now(); // Record the start time
    
        console.log('sab theek');
    
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
    
      return connection.write("+OK\r\n");
    }
    
    
    else if(command[2]=='GET'){
      if (map1.has(command[4])) {
        return connection.write(`$${map1.get(command[4]).length}\r\n${map1.get(command[4])}\r\n`);
    }
    return connection.write('$-1\r\n');
    }
    else if(command[2]=='CONFIG' && command[4]=='GET' ){
         if(addr.has(command[6])){  return connection.write("*2"+ "\r\n"+"$" + command[6].length+ "\r\n" + command[6]+"\r\n"+"$" + addr.get(command[6]).length + "\r\n" + addr.get(command[6])+ "\r\n" );}
        return connection.write('$-1\r\n');
    }
   
  });
});
server.listen(6379, "127.0.0.1");