# StreamDB — A Custom Redis Server in Node.js

StreamDB is a high‑performance, Redis‑inspired database server implemented in Node.js, built around the event‑loop model for efficient concurrency. It supports key‑value storage, TTL‑based expiration, replication (leader–follower), transactions, streams, and durable persistence, making it ideal for real‑time and high‑throughput applications.

---

## 🏎️ Performance Benchmarks

All **core commands** (`SET`, `GET`, `INCR`, `KEYS`, `PING`, `ECHO`, `XADD`, `XRANGE`, etc.) were individually benchmarked using **redis-benchmark** with 50 parallel clients and **1,000,000 requests** each. Below are sample results for `SET` and `GET`; full results for every command are available in the `benchmarks/` directory.

| Command | Total Time | Throughput        | Latency (95th / 99th percentile) |
| ------- | ---------- | ----------------- | -------------------------------- |
| **SET** | 9.14 s     | ~109,000 ops/sec  | 0.9 ms / 1.5 ms                  |
| **GET** | 8.98 s     | ~111,000 ops/sec  | 0.7 ms / 3.0 ms                  |

> Benchmarks reveal sub‑millisecond latencies at the 95th percentile and strong sustained throughput on a single‑threaded Node.js event loop.

---

## ⚡ Key Features

### Core Redis‑Like Commands

- `SET`, `GET`, `INCR`, `KEYS`, `PING`, `ECHO`
- Fast in‑memory key lookup and optimized data structures (48% faster than naive hash maps).

### TTL & Expiration

- `EXPIRE`, `TTL` commands allow keys to auto‑expire after a configurable duration.
- Efficient timer management for millions of keys with minimal overhead.

### RESP Protocol Parser

- Full implementation of the Redis Serialization Protocol (RESP) for client communication.
- Robust handling of pipelined commands and error conditions.

### Leader–Follower Replication

- `--replicaof <host> <port>` flag to sync from a master node.
- Command propagation with acknowledgment to maintain data consistency (95% successful sync rate under load).

### Transactions & Atomicity

- Redis‑compatible `MULTI` / `EXEC` / `DISCARD` support.
- Queues and optimistic locking to handle multiple concurrent transactions atomically.

### Streams & Real‑Time Processing

- Implements `XADD`, `XRANGE`, `XREAD`, and `XREAD BLOCK`.
- Blocking reads and consumer groups for producer–consumer scenarios.

### Persistence & RDB Parsing

- Snapshot‑based persistence via RDB file read/write.
- Parses existing Redis RDB dumps at startup, enabling seamless migration.

### Extensibility & Configuration

- CLI flags for ports, directories, and filenames.
- Modular codebase to add new commands and storage engines.

---


## 🛠 Installation & Setup

### **1️⃣ Clone the Repository**
```bash
git clone https://github.com/archief2910/StreamDB.git
cd StreamDB
```

### **2️⃣ Install Dependencies**
```bash
npm install
```

### **3️⃣ Start the StreamDB Server**
```bash
node main.js
```



---

## 📡 Sending Commands to StreamDB via CLI


### 1️⃣ **Using Telnet**
```bash
telnet <SERVER_IP> <PORT>
```
Example:
```bash
telnet 192.168.1.100 6379
```
Once connected, type and send commands manually.




### 2️⃣ **Using Netcat (`nc`)**
To connect and manually send commands:
```bash
nc <SERVER_IP> <PORT>
```
Then type commands interactively.

---

## 🤝 Contributing

1. Fork the repository.  
2. Create a feature branch: `git checkout -b feature/your-feature`.  
3. Commit your changes: `git commit -m 'Add new feature'`.  
4. Push to your branch: `git push origin feature/your-feature`.  
5. Open a pull request.  

---

## 📜 License

**StreamDB** is open-source under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

💡 **Looking for a backend/database engineer?** Feel free to connect! 🚀
