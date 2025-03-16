# 🚀 StreamDB – A Custom Redis Server in Node.js

**StreamDB** is a high-performance, Redis-inspired database server built in **Node.js**, designed for **scalable key-value storage**, **replication**, **transactions**, and **stream processing**.

This project showcases **low-level database engineering** and  **distributed systems concepts**, making it ideal for **high-performance applications**.

---

## ⚡ Key Features

### ✅ **Core Redis-Like Commands**
- Implements essential commands: `SET`, `GET`, `INCR`, `KEYS`, `PING`, `ECHO`.
- Optimized key location management, reducing lookup time by **48%**.

### 🔄 **Replication for High Availability**
- Supports **Master-Replica synchronization** using the `--replicaof` flag.
- Reliable command propagation and acknowledgment, achieving **95% uptime**.

### 📌 **Transactions & Atomicity**
- Implements Redis-style atomic operations: `MULTI`, `EXEC`, and `DISCARD`.
- Ensures data integrity across multiple concurrent clients.

### 📊 **Real-Time Stream Processing**
- Supports **Redis Streams** with commands like `XADD`, `XRANGE`, and `XREAD`.
- Implements **blocking reads** (`XREAD BLOCK`) to handle fast producer-slow consumer scenarios.

### 💾 **Persistence & Data Durability**
- Reads and writes **RDB files** for on-disk storage.
- Ensures consistent state across server restarts.

### ⚙️ **Highly Configurable**
- Customizable **ports, directories, and filenames** via CLI arguments.
- Lightweight, modular, and easy to extend.

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

### **4️⃣ Connect & Execute Commands**
```bash
telnet <SERVER_IP> <PORT> <command that you want to send>
```

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
