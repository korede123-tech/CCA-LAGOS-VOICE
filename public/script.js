const startBtn = document.getElementById("startBtn");
const status = document.getElementById("status");

let keepListening = false;

startBtn.addEventListener("click", async () => {
  if (keepListening) {
    keepListening = false;
    status.innerText = "🛑 Stopped listening.";
    return;
  }

  keepListening = true;

  while (keepListening) {
    try {
      status.innerText = "🎤 Listening...";
      const audioBlob = await recordAudio(5);

      // Transcribe audio
      const userText = await transcribe(audioBlob);
      console.log("🗣️ Transcribed:", userText);

      if (!userText || !keepListening) {
        status.innerText = "🤔 Didn't catch that. Listening again...";
        continue;
      }

      status.innerText = `🗣️ You said: "${userText}"`;

      // Get AI reply and language
      const { reply, language } = await getReplyFromCohere(userText);
      console.log("🤖 Reply:", reply);

      if (!reply || !keepListening) {
        status.innerText = "🤔 No response. Listening again...";
        continue;
      }

      status.innerText = `Bisi says (${language}): "${reply}"`;

      // Speak the reply
      const voiceBlob = await textToSpeech(reply);
      if (voiceBlob && keepListening) await playAudioAwaitable(voiceBlob);

    } catch (err) {
      console.error("🚨 Unexpected error:", err);
      status.innerText = "❌ Something went wrong. Check console.";
      break;
    }
  }
});

async function recordAudio(seconds = 5) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];

  return new Promise((resolve) => {
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      resolve(blob);
    };
    recorder.start();
    setTimeout(() => recorder.stop(), seconds * 1000);
  });
}

async function transcribe(audioBlob) {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.wav");

  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.status}`);
    }

    const data = await response.json();

    return data.text || data.transcript || "";
  } catch (error) {
    console.error("❌ Transcription error:", error);
    return "";
  }
}

async function getReplyFromCohere(userInput) {
  const detectLangPrompt = `Detect the language of this text. Respond only with the name:\n\n"${userInput}"`;

  try {
    const langRes = await fetch("/api/cohere", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: detectLangPrompt, max_tokens: 5 }),
    });

    const langData = await langRes.json();
    const language = langData.generations?.[0]?.text?.trim() || "English";

    const prompt = `
You are Bisi Silva, a Nigerian curator and artist reimagined as a multilingual AI. Reply in the **same language** as the user input. Keep responses under 60 words.

User (${language}): ${userInput}
Bisi (${language}):
    `.trim();

    const response = await fetch("/api/cohere", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, max_tokens: 200 }),
    });

    const data = await response.json();
    const reply = data.generations?.[0]?.text?.trim() || "Let me think about that.";

    return { reply, language };
  } catch (error) {
    console.error("❌ Cohere error:", error);
    return { reply: "", language: "English" };
  }
}

async function textToSpeech(text) {
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.status}`);
    }

    return await response.blob();
  } catch (error) {
    console.error("❌ TTS error:", error);
    return null;
  }
}

function playAudioAwaitable(blob) {
  return new Promise((resolve) => {
    const audio = new Audio(URL.createObjectURL(blob));
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play();
  });
}
