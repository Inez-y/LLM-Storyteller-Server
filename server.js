import dotenv from 'dotenv';
dotenv.config();

import express, { json } from 'express';
import jsonpkg from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
const { sign } = jsonpkg;
const app = express();

app.use(json());
app.use(cookieParser());

// Configure CORS for your specific client origin and enable credentials if needed.
app.use(cors({
  origin: 'https://storyteller-us7ph.ondigitalocean.app', // Exact match required when using credentials.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const SECRET_KEY = process.env.SECRET_KEY_JWT;

async function startServer() {
  try {
    // Establish a connection to the database using environment variables.
    const sql = postgres(connectionString);
    console.log('Connected to the database!');

    // Health Check endpoint
    app.get('/', (req, res) => {
      res.status(200).send('OK');
    });

    // Define a route that queries the database.
    app.get('/get-users', async (req, res) => {
      try {
        const users = await sql`SELECT * FROM users`;
        res.json(users);
      } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).send('Database query error');
      }
    });

    // Login endpoint using a parameterized query
    app.post('/login', async (req, res) => {
      const { username, password } = req.body;
      try {
        const users = await sql`SELECT * FROM users WHERE username = ${username}`;
        if (users.length === 0) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }
        const user = users[0];
        if (user.password !== password) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }
        const token = sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        res.cookie('auth-token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production'
        });
        const isAdmin = user.isAdmin ? true : false;
        res.json({ message: 'Logged in successfully' ,isAdmin: isAdmin});
      } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({ error: 'Database query error' });
      }
    });

    // Register endpoint using a parameterized INSERT query with RETURNING clause
    app.post('/register', async (req, res) => {
      const { username, password } = req.body;
      try {
        // Check if the username already exists
        const existingUsers = await sql`SELECT * FROM users WHERE username = ${username}`;
        if (existingUsers.length > 0) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        // Insert new user and return the inserted id.
        const result = await sql`
          INSERT INTO users (username, password)
          VALUES (${username}, ${password})
          RETURNING id
        `;
        res.status(201).json({ message: 'User registered successfully', userId: result[0].id });
      } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
      }
    });

    // Start the Express server.
    const port = process.env.PORT || 3000;
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error('Error connecting to the database:', err);
  }
}

startServer();
