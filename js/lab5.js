//  INSERT INTO patient (name, dateOfBirth) VALUES ('HI', '2025-02-17');
import * as msgs from '../lang/en.js';
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { URL } from "url";

class Lab5 {
    constructor(connection) {
        this.connection = connection;
        this.addUser = 'add-user'; // user input
        this.addUsers = 'add-users'; // default 
        this.getUser = 'get-user';
    }
  
    static async create() {
        try {
            const connection = await mysql.createConnection({
                host: process.env.HOSTNAME || '127.0.0.1', 
                user: process.env.USERNAME || 'root', // Use env or fallback
                password: process.env.PASSWORD || '', // Default blank for local testing
                database: process.env.DATABASE || 'test_db', // Default DB name
                port: process.env.DB_PORT || 3306
            });
            console.log("✅ Connected to MySQL (Localhost) for Lab5!");

            const instance = new Lab5(connection);
            await instance.createTable(); // Ensure table exists before usage
            return instance;
        } catch (err) {
            console.error("❌ Lab5 Initialization Error:", err.message);
            throw err;
        }
    }

    async query(sql, params = []) {
        try {
            const [rows] = await this.connection.execute(sql, params);
            return rows;
        } catch (err) {
            console.error("❌ Query Error:", err.message);
            throw err;
        }
    }

    async closeConnection() {
        if (this.connection) {
            await this.connection.end();
            console.log("🔌 MySQL connection closed.");
        }
    }

    async createTable() {
        const sql = `
        CREATE TABLE IF NOT EXISTS patient (
            patientId INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            dateOfBirth DATE NOT NULL
        ) ENGINE=InnoDB`; // innodb
        try {
            await this.connection.execute(sql);
            console.log("🛠️ Table 'patient' is ready!");
        } catch (err) {
            console.error("❌ Table Creation Error:", err.message);
        }
    }

    async handleAddUsers(body, res) {
        try {
            const users = JSON.parse(body);
            if (!Array.isArray(users) || users.length === 0) {
                res.writeHead(400, { "Content-Type": "application/json" }); // user error
                return res.end(JSON.stringify({ error: "Invalid or empty user array" }));
            }
    
            const values = users.map(user => {
                if (!user.name || !user.dateOfBirth) {
                    throw new Error("Missing required fields in one or more entries");
                }
                return [user.name, user.dateOfBirth];
            });
    
            const sql = "INSERT INTO patient (name, dateOfBirth) VALUES " +
            values.map(() => "(?, ?)").join(", ");
            const flatValues = values.flat(); // Flatten array
            await this.connection.query(sql, flatValues);

    
            res.writeHead(201, { "Content-Type": "application/json" }); 
            // 200; success
            // 201; created entry
            res.end(JSON.stringify({ message: "Users added successfully" }));
        } catch (err) {
            console.error("❌ Add Users Error:", err.message);
            res.writeHead(500, { "Content-Type": "application/json" });
            // 500; internal server error - something goes wrong when processing the request
            res.end(JSON.stringify({ error: err.message }));
        }
    }
    
    async runSQLQuery(sql, params = []) {
        try {
            console.log("🔍 SQL Execution Debug:");
            console.log("  ➜ SQL:", sql);
            console.log("  ➜ Params:", params);
    
            const firstWord = sql.trim().split(" ")[0].toUpperCase();
            if (!["SELECT", "INSERT"].includes(firstWord)) {S
                throw new Error("❌ Unauthorized SQL command.");
            }
    
            if (firstWord === "INSERT") {
                const [result] = await this.connection.execute(sql, params);
                console.log("✅ Insert Successful! Result:", result);
    
                return { success: true, message: "Insert successful!", insertId: result.insertId };
            } else {
                const [rows] = await this.connection.execute(sql, params);
                return { success: true, data: rows };
            }
        } catch (err) {
            console.error("❌ SQL Execution Error:", err.message);
            return { success: false, error: err.message };
        }
    }

    async handleGETRequest(req, res) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const sql = url.searchParams.get("sql");

        if (!sql) {
            res.writeHead(400, { "Content-Type": "application/json" }); // user error
            return res.end(JSON.stringify({ error: "Missing SQL query parameter" }));
        }

        console.log("🔎 Executing SQL (GET):", sql);

        try {
            const result = await this.runSQLQuery(sql);
            res.writeHead(200, { "Content-Type": "application/json" });  // success
            res.end(JSON.stringify(result));
        } catch (err) {
            console.error("❌ GET SQL Error:", err.message);
            res.writeHead(500, { "Content-Type": "application/json" }); // internal server error - 
            res.end(JSON.stringify({ error: err.message }));
        }
    }
    
    async handlePOSTRequest(req, res) {
        let body = "";
        try {
            console.log("📡 Receiving POST request...");
    
            await new Promise((resolve, reject) => {
                req.on("data", chunk => { 
                    body += chunk.toString(); 
                });
                req.on("end", resolve);
                req.on("error", reject);
            });
    
            console.log("📨 Received Data:", body);  
    
            const data = JSON.parse(body);
            console.log("data" + data);
            let sql = data.sql.trim();
            console.log("sql" + sql);

            if (!sql) {
                res.writeHead(400, { "Content-Type": "application/json" });
                // user error - client side error
                return res.end(JSON.stringify({ error: "Missing SQL query parameter" }));
            }
    
            console.log("📝 Executing SQL (POST):", sql); 
    
            const result = await this.runSQLQuery(sql);
    
            console.log("📤 SQL Execution Result:", result);
    
            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
    
        } catch (err) {
            console.error("❌ POST SQL Error:", err.message);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON format or request error" }));
        }
    }

    async handleSQLRequest(req, res) {
        try {
            if (req.method === "GET") {
                return await this.handleGETRequest(req, res);
            } else if (req.method === "POST") {
                return await this.handlePOSTRequest(req, res);
            } else {
                res.writeHead(405, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Method Not Allowed" }));
            }
        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
             // internal server error 
            res.end(JSON.stringify({ error: err.message }));
        }
    }
    
    
    start(url, method, req, res, body) {
        this.createTable(); // Ensure table exists before usage
        if (method === "POST" && url.pathname.includes(this.addUsers)) {
            this.handleAddUsers(body, res);
        } else if (method === "POST" && url.pathname.includes(this.addUser)) {
            this.handleSQLRequest(req, res);
        } else if (method === "GET" && url.pathname.includes(this.getUser)) {
            this.handleSQLRequest(req, res);
        } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            // 400 Bad Request ❌ – Invalid request data
            res.end(JSON.stringify({ error: msgs.lab5.invalid_method }));
        }
    }
}

export { Lab5 };
