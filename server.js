import dotenv from 'dotenv';
dotenv.config();

import express, { json } from 'express';
import jsonpkg from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import postgres from 'postgres';

import axios from 'axios';
import OpenAI from 'openai';

// for api specification
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const swaggerDocument = YAML.load('./swagger.yaml');

const connectionString = process.env.DATABASE_URL;
const { sign } = jsonpkg;
const app = express();

app.use(express.json()); // add express
app.use(cookieParser());
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Configure CORS for your specific client origin and enable credentials if needed.
app.use(cors({
  origin: 'https://storyteller-us7ph.ondigitalocean.app', // Exact match required when using credentials.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const SECRET_KEY = process.env.SECRET_KEY_JWT;

async function translateText(prompt) {
  try {
    // Construct the URL with the query parameter for the prompt
    const apiUrl = `http://134.199.215.216:8000/t2t?prompt=${encodeURIComponent(prompt)}`;

    // Make the GET request
    const response = await axios.get(apiUrl);

    // Return the translated text (adjust based on the actual response format)
    return response.data.generated_text || 'Translation failed';
  } catch (error) {
    console.error('Error during translation:', error);
    throw new Error('Translation API request failed');
  }
}

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

    app.get('/get-user-usage', async (req, res) => {
      try {
        const usage = await sql`SELECT * FROM user_api_usage`;
        res.json(usage);
      } catch (error) {
        console.error('Error executing query', error);
        res.status(500).send('Database query error');
      }
    });

    app.get('/get-api-usage', async (req, res) => {
      try {
        const usage = await sql`SELECT * FROM api_stats`;
        res.json(usage);
      } catch (error) {
        console.error('Error executing query: ', error);
        res.status(500).send('Database query error');
      }
    });

    // req to hosted LLM
    app.get('/t2t', async (req, res) => {
      const prompt = req.query.prompt; // parse from url
      try {
        const translatedText = await translateText(prompt);
        res.json({ translatedText });
      } catch (error) {
        console.error('Error during translation:', error);
        res.status(500).send('Error during translation');
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
        res.json({ message: 'Logged in successfully', isAdmin: isAdmin });
      } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({ error: 'Database query error' });
      }
    });

    // logout by deleting cookie
    app.get('/logout', (req, res) => {
      res.clearCookie('auth-token');
      res.redirect('https://storyteller-us7ph.ondigitalocean.app/');
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

    // Delete user endpoint using a parameterized query
    app.delete('/delete-user', async (req, res) => {
      const { id } = req.body; // Ensure the client sends the user id in the request body
      try {
        await sql`
          DELETE FROM users
          WHERE id = ${id}
        `;
        res.status(200).json({ message: 'User deleted successfully' });
      } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Delete user failed' });
      }
    });

    app.put('/update-user', async (req, res) => {
      // Destructure the id and all other properties (should only be one)
      const { id, ...updateFields } = req.body;

      // Ensure exactly one field is provided for update.
      const fields = Object.keys(updateFields);
      if (fields.length !== 1) {
        return res.status(400).json({ error: 'Invalid request: exactly one field must be updated.' });
      }

      const field = fields[0];
      const newValue = updateFields[field];

      try {
        // If updating the username, ensure it is not taken by another user.
        if (field === 'username') {
          const existingUsers = await sql`
            SELECT * FROM users 
            WHERE username = ${newValue} AND id != ${id}
          `;
          if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
          }
        }

        // Update the specified field.
        let result;
        if (field === 'username') {
          result = await sql`
            UPDATE users
            SET username = ${newValue}
            WHERE id = ${id}
            RETURNING *
          `;
        } else if (field === 'password') {
          result = await sql`
            UPDATE users
            SET password = ${newValue}
            WHERE id = ${id}
            RETURNING *
          `;
        } else {
          return res.status(400).json({ error: 'Invalid field provided. Only "username" or "password" can be updated.' });
        }

        if (result.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ message: 'User updated successfully', user: result[0] });
      } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: 'User update failed' });
      }
    });

    // gpt server
    app.post('/gpt-talk', async (req, res) => {
      console.log("Connecting to GPT...");
      const client = new OpenAI({ apiKey: process.env.OPENAI_KEY });

      try {
        const userPrompt = req.body.prompt;
        const response = await client.chat.completions.create({
          model: "gpt-4o-audio-preview",
          modalities: ["text", "audio"],
          audio: { voice: "alloy", format: "wav" },
          messages: [
            { role: "system", content: "Text Response" },
            { role: "user", content: userPrompt }
          ],
          store: true,
        });

        console.log("Full GPT response:", JSON.stringify(response, null, 2));

        if (!response.choices || response.choices.length === 0) {
          return res.status(500).json({ error: "No response from GPT." });
        }

        const answer = response.choices[0].message.audio?.transcript || "No text response";
        const answer_voice = response.choices[0].message.audio?.data || null;

        console.log("GPT Answer:", answer);
        console.log("Audio Base64:", answer_voice ? "Received" : "Not received");

        res.json({ response: answer, audio: answer_voice });

      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
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
