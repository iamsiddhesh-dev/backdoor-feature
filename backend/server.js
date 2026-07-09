// HTTP layer. One endpoint: receive the uploaded video, run it through both
// pipeline stages (TRANSCRIBE then EXTRACT), and return the combined JSON.
//
// No database — session state (video + results, keyed by an id) is held in
// an in-memory Map plus the video file on disk under uploads/. The video
// itself must survive past the transcription step: the founder view (Step 5)
// needs to be able to play it back when confidence clears the threshold.

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { transcribeVideo } = require("./transcribe");
const { extractSignal } = require("./extract");

const UPLOADS_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Video only surfaces to founders once the extraction is confident enough.
const CONFIDENCE_THRESHOLD = Number(process.env.CONFIDENCE_THRESHOLD) || 70;

// sessionId -> { videoPath, transcript, extraction, confirmedAdditions }.
// In-memory only — wiped on server restart, fine for a demo with no
// persistence layer.
const sessions = new Map();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024 * 1024 }, // phone recordings can be large even at 60s
});

app.post("/api/process-video", upload.single("video"), async (req, res) => {
  if (!req.file) {
    console.log("[process-video] rejected: no file in request");
    return res.status(400).json({ error: "No video file uploaded (field name must be 'video')" });
  }

  const sessionId = crypto.randomUUID();
  const videoPath = path.join(UPLOADS_DIR, `${sessionId}.mp4`);
  console.log(`[process-video] received ${(req.file.size / 1024 / 1024).toFixed(1)}MB, session ${sessionId}`);

  try {
    fs.writeFileSync(videoPath, req.file.buffer);
    console.log(`[process-video] ${sessionId}: transcribing...`);

    // STEP: TRANSCRIBE
    const transcript = await transcribeVideo(req.file.buffer, req.file.originalname || "intro.mp4");
    console.log(`[process-video] ${sessionId}: transcribed — "${transcript.text.slice(0, 60)}..."`);

    // STEP: EXTRACT
    const extraction = await extractSignal(transcript.text);
    console.log(`[process-video] ${sessionId}: extracted — confidence ${extraction.confidence_score}`);

    sessions.set(sessionId, { videoPath, transcript, extraction });

    const videoEligible = extraction.confidence_score >= CONFIDENCE_THRESHOLD;
    const founderUrl = `${req.protocol}://${req.get("host")}/founder.html?session=${sessionId}`;

    // Founder link is backend/operator info, not something surfaced to the
    // candidate in the mobile app — log it here in full so whoever runs the
    // backend can grab it and hand it to the founder.
    if (videoEligible) {
      console.log(`[process-video] ${sessionId}: FOUNDER REVIEW AVAILABLE — ${founderUrl}`);
    }

    res.json({ sessionId, transcript, extraction, videoEligible, confidenceThreshold: CONFIDENCE_THRESHOLD });
  } catch (err) {
    console.error(`[process-video] ${sessionId}: FAILED —`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Candidate confirms which extracted facts they actually want added to their
// resume (the mobile checklist is opt-out by default). Recorded on the
// session so it's on the record — nothing downstream reads it yet, but it's
// no longer silently discarded.
app.post("/api/confirm-additions", (req, res) => {
  const { sessionId, confirmedAdditions } = req.body || {};
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: `Unknown sessionId: ${sessionId}` });
  }
  if (!Array.isArray(confirmedAdditions)) {
    return res.status(400).json({ error: "confirmedAdditions must be an array of strings" });
  }

  session.confirmedAdditions = confirmedAdditions;
  console.log(
    `[confirm-additions] ${sessionId}: confirmed ${confirmedAdditions.length}/${session.extraction?.resume_additions?.length ?? 0} items`
  );

  res.json({ sessionId, confirmedAdditions });
});

// FOUNDER VIEW data. founder_blurb always comes back; videoEligible tells
// the frontend whether it's allowed to even offer the video for review —
// gated purely on confidence_score, never on candidate or founder preference.
app.get("/api/session/:sessionId", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: `Unknown sessionId: ${req.params.sessionId}` });
  }

  const { extraction } = session;
  res.json({
    founder_blurb: extraction.founder_blurb,
    confidence_score: extraction.confidence_score,
    confidence_reasoning: extraction.confidence_reasoning,
    videoEligible: extraction.confidence_score >= CONFIDENCE_THRESHOLD,
    confidenceThreshold: CONFIDENCE_THRESHOLD,
  });
});

// Video stream — enforced server-side, not just hidden in the UI. Even a
// direct request for this URL gets rejected if confidence didn't clear the
// bar, and this is a separate opt-in fetch (Step 5's "founder opts in to
// video review" toggle) rather than being embedded automatically.
app.get("/api/session/:sessionId/video", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: `Unknown sessionId: ${req.params.sessionId}` });
  }
  if (session.extraction.confidence_score < CONFIDENCE_THRESHOLD) {
    return res.status(403).json({ error: "Confidence score below review threshold" });
  }

  res.sendFile(session.videoPath);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend listening on http://0.0.0.0:${PORT}`);
});
