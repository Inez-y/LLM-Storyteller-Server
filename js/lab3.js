import fs from 'fs';
import * as msgs from '../lang/en.js';
import * as utils from '../modules/utils.js';

class Lab3 {
    constructor() {
        this.filename = 'file.txt';
        this.getDateStr = 'getDate';
        this.writeFileStr = 'writeFile';
        this.readFileStr = 'readFile';
    }

    getDate(name) {
        const greeting = msgs.lab3.message.replace('%1', name);
        const fullMessage = greeting + utils.lab3.getDateString();
        return fullMessage; 
    }

    writeFile(text,res) {
        fs.appendFile(this.filename, text, (err) => {
            if(err) {
                res.writeHead(500, {'Content-Type':'text/plain'});
                res.end(msgs.lab3.file_error);
            } else {
                res.writeHead(200, {'Content-Type':'text/plain'});
                res.end(msgs.lab3.write_success);
            }
        })
    }

    readFile(filename,res) {
        fs.readFile(filename, 'utf8', (err,data) => {
            if (err) {
                res.writeHead(500, {'Content-Type':'text/plain'});
                res.end(msgs.lab3.file_error);
            } else {
                res.writeHead(200, {'Content-Type':'text/plain'});
                res.end(data);
            }
        })
    }

    start(req, res) {
        const url = new URL(req.url, `https://${req.headers.host}`);
        if(url.pathname.includes(this.getDateStr)) {
            const response = this.getDate(url.searchParams.get('name'));
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end(response);
            
        } else if (url.pathname.includes(this.writeFileStr)) {
            this.writeFile(url.searchParams.get('text'),res);            
        } else if(url.pathname.includes(this.readFileStr)) {
            this.readFile(url.pathname.split('/').pop(),res);
        }
    }
}

export { Lab3 };
