// TRANSCRIBE step: video/audio file buffer -> transcript with timestamps.
// Isolated from both the HTTP layer (server.js) and the EXTRACT step
// (extract.js) so each pipeline stage can be tested and swapped independently.
//
// Uses Groq's OpenAI-compatible audio transcription endpoint (Whisper).

require("dotenv").config();
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo";

// Groq's transcription endpoint rejects large uploads, and a raw video file
// (video track included) blows past that limit fast even for a 60s clip.
// Whisper only needs the audio, so strip the video track first — this also
// shrinks a multi-MB video down to a few hundred KB of compressed audio.
function extractAudio(videoPath) {
  const audioPath = path.join(os.tmpdir(), `${crypto.randomUUID()}.m4a`);
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("aac")
      .audioBitrate("64k")
      .audioChannels(1)
      .output(audioPath)
      .on("end", () => resolve(audioPath))
      .on("error", reject)
      .run();
  });
}

/**
 * @param {Buffer} fileBuffer raw video file bytes
 * @param {string} filename original filename (used only for the temp file extension)
 * @returns {Promise<{ text: string, segments: Array }>}
 */
async function transcribeVideo(fileBuffer, filename) {
  const ext = path.extname(filename) || ".mp4";
  const videoPath = path.join(os.tmpdir(), `${crypto.randomUUID()}${ext}`);
  let audioPath;

  try {
    await fs.writeFile(videoPath, fileBuffer);
    audioPath = await extractAudio(videoPath);

    const audioBuffer = await fs.readFile(audioPath);
    const form = new FormData();
    form.append("file", new Blob([audioBuffer], { type: "audio/m4a" }), "audio.m4a");
    form.append("model", GROQ_WHISPER_MODEL);
    form.append("response_format", "verbose_json");

    const res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq transcription error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return {
      text: data.text,
      segments: (data.segments || []).map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
    };
  } finally {
    await fs.rm(videoPath, { force: true });
    if (audioPath) await fs.rm(audioPath, { force: true });
  }
}

module.exports = { transcribeVideo };
