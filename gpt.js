import OpenAI from "openai";
import express from "express";
import dotenv from "dotenv";

const app = express();
const port = 3000;

app.use(express.json());


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


app.post("/generate", async (req, res) => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: req.body.prompt }],
        });
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});