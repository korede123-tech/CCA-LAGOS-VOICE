require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const multer = require('multer');
const cors = require('cors');
const FormData = require('form-data');

const app = express();
const upload = multer(); // For handling multipart/form-data
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/**
 * 🎙️ Transcription Endpoint
 */
app.post("/api/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded." });
    }

    const formData = new FormData();
    formData.append("file", req.file.buffer, "recording.wav");
    formData.append("model_id", "scribe_v1");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Transcription failed:", err);
    res.status(500).json({ error: "Transcription failed" });
  }
});

/**
 * ✍️ Cohere Prompt Completion
 */
app.post("/api/cohere", async (req, res) => {
  const { prompt, max_tokens } = req.body;

  try {
    const response = await fetch("https://api.cohere.ai/v1/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "command-r-plus",
        prompt,
        max_tokens,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Cohere failed:", err);
    res.status(500).json({ error: "Cohere failed" });
  }
});

/**
 * 🔊 Text-to-Speech (TTS)
 */
app.post("/api/tts", async (req, res) => {
  const { text } = req.body;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.8,
          },
        }),
      }
    );

    const buffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("TTS failed:", err);
    res.status(500).json({ error: "TTS failed" });
  }
});

// ✅ Start the server (dynamic port for Render)
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT} (or your Render URL in production)`);
});
