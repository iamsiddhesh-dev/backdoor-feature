// PROCESSING layer entry point. This is the ONLY seam between capture and
// processing: whatever produced the video file (this camera screen today, a
// WhatsApp-based capture layer later) just needs to call processVideo(uri)
// and get back extraction JSON. No capture-specific logic belongs in here,
// and no processing logic belongs in the camera screen.
//
// TODO (Step 3): replace the stub below with a real upload to the backend
// (multipart POST of the video file) which runs TRANSCRIBE -> EXTRACT and
// returns the same JSON shape.

const BACKEND_URL = "http://localhost:3000"; // placeholder, wired in Step 3

/**
 * @param {string} videoUri local file uri of the recorded video
 * @returns {Promise<object>} extraction JSON (see backend/extract.js schema)
 */
export async function processVideo(videoUri) {
  console.log("processVideo received file:", videoUri);

  // Stub: simulate network/processing latency, return a fixed sample result
  // so the capture screen and later the candidate view can be built and
  // tested end-to-end before the backend is wired up.
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return {
    resume_additions: [
      "(stub) resume_additions will come from the real backend in Step 3/4",
    ],
    founder_blurb: "(stub) founder_blurb placeholder from processVideo stub.",
    confidence_score: 0,
    confidence_reasoning: "(stub) no real transcript processed yet.",
    email_hooks: [],
  };
}
