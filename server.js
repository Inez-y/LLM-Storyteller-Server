import http from 'http';
import { URL } from 'url';
import * as msgs from './lang/en.js';
import * as labs from './js/labs.js';

class Server {
    constructor() {
        this.lab3_str = '/comp4537/labs/3';
        this.lab5_str = '/comp4537/labs/5';
    }

    start() {
        http.createServer((req, res) => {
            // Set CORS headers for all responses
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
            res.setHeader("Access-Control-Allow-Credentials", "true"); // Allow cookies if needed
            res.setHeader("Vary", "Origin"); // Helps in dynamic CORS handling

            // Handle CORS preflight requests properly
            if (req.method === 'OPTIONS') {
                res.writeHead(204); //  the server successfully processed the request, but there is no content to return in the response body
                res.end();
                return;
            }

            // Parse the full URL
            const fullUrl = new URL(req.url, `http://${req.headers.host}`);
            const pathName = fullUrl.pathname;
            const method = req.method;
            
            if (pathName.includes(this.lab3_str)) {
                labs.lab3Instance.start(req, res);
            } else if (pathName.includes(this.lab5_str)) {
                let body = '';
                req.on('data', chunk => {
                    body += chunk;
                });
                req.on('end', () => {
                    labs.lab5Instance.start(fullUrl, method, req, res, body);
                });
            } else {
                res.writeHead(404, { 
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*" 
                });
                res.end(JSON.stringify({ error: msgs.BAD_REQUEST_MSG }));
            }
        }).listen(8080, '127.0.0.1', () => {
            console.log("Server is listening on http://127.0.0.1:8080");
        });
    }
}

const server = new Server();
server.start();
