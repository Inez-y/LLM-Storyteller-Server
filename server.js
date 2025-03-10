require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

async function startServer() {
  try {
    // Establish a connection to the database using environment variables.
    const connection = await mysql.createConnection({
      host: process.env.HOST,
      user: process.env.USERNAME,       // Map USERNAME to user
      password: process.env.PASSWORD,
      database: process.env.DATABASE,
      port: process.env.PORT,
      // Configure SSL if required
      ssl: process.env.SSLMODE === 'require' ? { rejectUnauthorized: false } : null
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
