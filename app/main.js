const net = require("net");
const fs = require("fs");
const path = require("path");
const {getKeysValues,h} = require("./parseRDB.js");
const {broadcastToReplicas,broadcastToReplicasWithTimeout,parseCommandChunks,serializeRESP} = require("./broadcasting.js");
const {setNestedValue,getEntriesInRange}=require("./streams.js");
const {lowerBound, upperBound} = require("./search.js");
const portIdx = process.argv.indexOf("--port");
 const replicaidx = process.argv.indexOf("--replicaof");
 const PORT = portIdx == -1 ? 6379 : process.argv[portIdx + 1]
 const masterString = replicaidx == -1 ? "" : process.argv[replicaidx + 1]
 const masterArray = masterString.split(" ")
 const replicaConnections = new Map();
 const availableReplicas = new Map();
 const stream =new Map();
let offset=0;

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
// ye hai replica 
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

// ye hai master server
const server = net.createServer((connection) => {
  console.log("Client connected");
  connection.on("data", (data) => {
    console.log("Received:", data);
    const command = Buffer.from(data).toString().split("\r\n");
    if (command[2].toUpperCase() === "PING") {
      connection.write(serializeRESP("PONG"));
    } else if (command[2].toUpperCase()=== "ECHO") {
      const str = command[4];
      connection.write(serializeRESP(str));
    } else if (command[2].toUpperCase() === "SET") {
      offset+= serializeRESP([command[2],command[4],command[6]]).length;
      broadcastToReplicas(replicaConnections,data);
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
    } else if (command[2].toUpperCase() === "GET") {
      broadcastToReplicas(replicaConnections,data);
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
    } else if (command[2].toUpperCase() === "CONFIG" && command[4].toUpperCase() === "GET") {
      if (addr.has(command[6])) {
        connection.write(
          serializeRESP([command[6], addr.get(command[6])])
        );
      } else {
        connection.write(serializeRESP(null));
      }
    } else if (command[2].toUpperCase() === "KEYS") {
      broadcastToReplicas(replicaConnections,data);
     // Get all keys from map1
  const keys = Array.from(map1.keys());
  // Serialize keys into RESP format
  const respKeys = `*${keys.length}\r\n` + keys.map(key => `$${key.length}\r\n${key}\r\n`).join('');
  // Send the serialized response
  connection.write(respKeys);
    }else if (command[2].toUpperCase() === "INFO") {
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
    } else if (command[2].toUpperCase() === "REPLCONF" && command[4].toLowerCase() === "listening-port" && replicaidx ===-1) {
      connection.write("+OK\r\n");
    } else if (command[2].toUpperCase() === "REPLCONF" && command[4].toLowerCase() === "capa"  && replicaidx ===-1) {
      connection.write("+OK\r\n");
    } else if(command[2].toUpperCase() === "REPLCONF" && command[4].toUpperCase() === "ACK"){
      const clientAddress = `${connection.remoteAddress}:${connection.remotePort}`;
      
      availableReplicas.set(clientAddress,parseInt(command[6]));
      console.log(`${offset} &&& ${availableReplicas[clientAddress]}`)
      offset = Math.min(availableReplicas.get(clientAddress),offset);
      console.log(`${offset} &&& ${availableReplicas[clientAddress]}`)
    }
     else if (command[2].toUpperCase() === "PSYNC" && command[4] === "?" && command[6] === "-1"   && replicaidx ===-1) {
      const clientAddress = `${connection.remoteAddress}:${connection.remotePort}`;
      if (!replicaConnections.has(clientAddress)) {
          replicaConnections.set(clientAddress, connection);
          availableReplicas.set(clientAddress,0);
          console.log(`Replica added: ${clientAddress}`);
      }
      const base64 = "UkVESVMwMDEx+glyZWRpcy12ZXIFNy4yLjD6CnJlZGlzLWJpdHPAQPoFY3RpbWXCbQi8ZfoIdXNlZC1tZW3CsMQQAPoIYW9mLWJhc2XAAP/wbjv+wP9aog=="
      const rdbBuffer = Buffer.from(base64, "base64");
      const rdbHead = Buffer.from(`$${rdbBuffer.length}\r\n`)
      connection.write("+FULLRESYNC 8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb 0\r\n");
      connection.write(Buffer.concat([rdbHead, rdbBuffer]));
    }  else if(command[2].toUpperCase()==="WAIT"){
      if(offset==0){connection.write(`:${replicaConnections.size}\r\n`);}
      else{ 
        broadcastToReplicas(replicaConnections,serializeRESP(["REPLCONF","GETACK","*"]));
        console.log(offset+"laude main vapas aa gaya");
      const timeout = parseInt(command[6], 10); // Timeout in milliseconds
const y = parseInt(command[4], 10); // Number of replicas to check
broadcastToReplicasWithTimeout(replicaConnections, availableReplicas,offset, timeout, (successfulReplicas) => {
  console.log(`Successful Replicas: ${successfulReplicas}`);
  console.log(`offset: ${offset}`);
  console.log(`${successfulReplicas} & ${y} replicas`)
successfulReplicas = Math.min(successfulReplicas, y);
console.log(`${successfulReplicas}`)
      connection.write(serializeRESP(successfulReplicas));
});
    }
    }else if (command[2].toUpperCase()==="TYPE"){
      if(stream.has(command[4])){connection.write(serializeRESP(`stream`));}
      else if(map1.has(command[4])){connection.write(serializeRESP(`${typeof map1.get(command[4])}`));}
      else{connection.write(serializeRESP("none"));}
    }else if(command[2].toUpperCase()==="XADD"){
      let i=8;
      let k1=[];
      while(i<command.length){
      k1.push(command[i]); i+=2;
      }
      if(command[6]=="*"){
        const f=Date.now();
        if(!stream.has(command[4])){
          setNestedValue(stream,command[4],f,0,k1);
          connection.write(serializeRESP(`${f}-${0}`));
        }else{
        let mp = stream.get(command[4]);
  const greatestValue = Math.max(...mp.keys());
  if(greatestValue>f){connection.write("-ERR The ID specified in XADD is equal or smaller than the target stream top item\r\n");}
  else{
    if(greatestValue==f){
      let first=mp.get(f);
       const greatestValue1 = Math.max(...first.keys());
       setNestedValue(stream,command[4],f,1+greatestValue1,k1);
        connection.write(serializeRESP(`${f}-${1+greatestValue1}`));
    }
    else{
      if(f==0){setNestedValue(stream,command[4],f,1,k1);
        connection.write(serializeRESP(`${f}-1`));}
        else{
          
          setNestedValue(stream,command[4],f,0,k1);
          connection.write(serializeRESP(`${f}-0`));}
      
    }
  }}
      }
      else{
      const parts = command[6].split('-');
if(parts[1]=="*"){
  const f = parseInt(parts[0], 10);
  
  if(!stream.has(command[4])){
    if(f==0){setNestedValue(stream,command[4],f,1,k1);
      connection.write(serializeRESP(`${f}-1`));}
      else{
        
        setNestedValue(stream,command[4],f,0,k1);
        connection.write(serializeRESP(`${f}-0`));}
  }else{
  let mp = stream.get(command[4]);

  const greatestValue = Math.max(...mp.keys());
  if(greatestValue>f){connection.write("-ERR The ID specified in XADD is equal or smaller than the target stream top item\r\n");}
  else{
    if(greatestValue==f){
      let first=mp.get(f);
       const greatestValue1 = Math.max(...first.keys());
       setNestedValue(stream,command[4],f,1+greatestValue1,k1);
        connection.write(serializeRESP(`${f}-${1+greatestValue1}`));
    }
    else{
      if(f==0){setNestedValue(stream,command[4],f,1,k1);
        connection.write(serializeRESP(`${f}-1`));}
        else{
          
          setNestedValue(stream,command[4],f,0,k1);
          connection.write(serializeRESP(`${f}-0`));}
      
    }
  }
}
}
else{
const f = parseInt(parts[0], 10);
const s = parseInt(parts[1], 10);
 let mp = stream.get(command[4]);
 if(!stream.has(command[4])){
  if(f<=0 && s<=0){connection.write("-ERR The ID specified in XADD must be greater than 0-0\r\n");}
  else{setNestedValue(stream,command[4],f,s,k1);
  connection.write(serializeRESP(command[6]));}
}else{
     
     const greatestValue = Math.max(...mp.keys());
     if(f<=0 && s<=0){connection.write("-ERR The ID specified in XADD must be greater than 0-0\r\n");}
     else if(greatestValue<=f){
      if(greatestValue==f){
       let first=mp.get(f);
       const greatestValue1 = Math.max(...first.keys());
       if(greatestValue1<s){
        console.log("gadbad hogayi");
        setNestedValue(stream,command[4],f,s,k1);
      connection.write(serializeRESP(command[6]));
       }
       else{connection.write("-ERR The ID specified in XADD is equal or smaller than the target stream top item\r\n");}
      }
      else{
        setNestedValue(stream,command[4],f,s,k1);
      connection.write(serializeRESP(command[6]));
      }
     }
     else{
      connection.write("-ERR The ID specified in XADD is equal or smaller than the target stream top item\r\n");
     }
     
     
     }
    
    }
    
    }
    }else if(command[2].toUpperCase()=="XRANGE"){
      let firstrange="";
      let lastrange="";
      
        let first=stream.get(command[4]);
       const min1 = Math.min(...first.keys());
        let second=first.get(min1);
        const min2 = Math.min(...second.keys());
        firstrange=`${min1}-${min2}`;
      
      
        let first1=stream.get(command[4]);
        const mi1 = Math.max(...first1.keys());
         let second1=first1.get(mi1);
         const mi2 = Math.max(...second1.keys());
         lastrange=`${mi1}-${mi2}`;
      
      let res=getEntriesInRange(stream,command[4],firstrange,lastrange);
      console.log(res);
      if(command[6]!="-"){
        firstrange=command[6];
        if (!firstrange.includes("-")) {
          firstrange+="-0";
        } 
      }
      if(command[8]!="+"){
        lastrange=command[8];
        if (!lastrange.includes("-")) {
          lastrange+="-0";
        } 
      }
      // Perform binary search
let startIdx = lowerBound(res, firstrange);
let endIdx = upperBound(res, lastrange);

// Filter entries within the range
let res1 = res.slice(startIdx, endIdx);

// Send the result
connection.write(serializeRESP(res1));


    }else if(command[2].toUpperCase()=="XREAD"){
    let sizer=command.length;
    sizer-=5;
      if(command[4].toLowerCase()=="block"){

      }
      else{
        let res1=[];
        for(let i=0; i<sizer/4; i++){
          let res2=[];
          let lastrange="";
          let firstrange="";
          let first1=stream.get(command[6+(2*i)]);
        const mi1 = Math.max(...first1.keys());
         let second1=first1.get(mi1);
         const mi2 = Math.max(...second1.keys());
         lastrange=`${mi1}-${mi2}`;
         let first=stream.get(command[6+(2*i)]);
         const min1 = Math.min(...first.keys());
          let second=first.get(min1);
          const min2 = Math.min(...second.keys());
          firstrange=`${min1}-${min2}`;
          let res=getEntriesInRange(stream,command[6+(2*i)],firstrange ,lastrange);
          console.log(command[6+(2*i)+(sizer/4)]);
          let startidx=lowerBound(res, command[6+(2*i)+(sizer/2)]);
          let endIdx = lowerBound(res, lastrange);
          let res3 = res.slice(startidx, endIdx);
          res2.push(command[6+(2*i)]);
          res2.push(res3);
          res1.push(res2);
        }
        connection.write(serializeRESP(res1));
      }
    }
    else {
      connection.write(serializeRESP("ERR unknown command"));
    }
    
  });
});
server.listen(PORT, "127.0.0.1");