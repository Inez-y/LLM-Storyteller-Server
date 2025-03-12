require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors());

app.use(cors({
  origin: 'https://storyteller-us7ph.ondigitalocean.app/',  // specify the allowed origin
  credentials: true
}));


const SECRET_KEY = process.env.SECRET_KEY_JWT;

async function startServer() {
  try {
    // Establish a connection to the database using environment variables.
    const connection = await mysql.createConnection({
      host: process.env.HOST,
      user: process.env.USERNAME,       // Map USERNAME to user
      password: process.env.PASSWORD,
      database: process.env.DATABASE,
      port: process.env.PORT,
    });
    console.log('Connected to the database!');

    // Define a route that queries the database.
    app.get('/get-users', async (req, res) => {
      try {
        const [rows] = await connection.execute('SELECT * FROM users');
        res.json(rows);
      } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).send('Database query error');
      }
    });

    app.post('/login', async (req, res) => {
      const { username,password } = req.body;

      try {
        const [rows] = await connection.execute(
          `SELECT * FROM users WHERE username = ?`, 
          [username]
        );

        if (rows.length === 0) {
          return res.status(401).json({ error: 'Invalid username or password'});
        }

        const user = rows[0];

        if (user.password !== password) {
          return res.status(401).json({ error: 'Invalid username or password'});
        }

        const token = jwt.sign({ id: user.id, username: user.username}, SECRET_KEY, {expiresIn: '1h'});

        res.cookie('auth-token',token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production'
        });
        res.json({message: 'Logged in successfully'});
      } catch (error) {
        console.error('Database query error: ', error);
        res.status(500).json({error: 'Database query error'});
      }
    });

    app.post('/register', async (req, res) => {
      const { username, password } = req.body;
    
      try {
        // Check if the username already exists in the database
        const [existingUsers] = await connection.execute(
          'SELECT * FROM users WHERE username = ?',
          [username]
        );
        
        if (existingUsers.length > 0) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        
        // Insert new user into the database
        const [result] = await connection.execute(
          'INSERT INTO users (username, password) VALUES (?, ?)',
          [username, password]
        );
        
        res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
      } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
      }
    });
    
    // Start the Express server.
    const PORT = process.env.APP_PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Error connecting to the database:', err);
  }
}

startServer();
