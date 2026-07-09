// PROCESSING layer entry point. This is the ONLY seam between capture and
// processing: whatever produced the video file (this camera screen today, a
// WhatsApp-based capture layer later) just needs to call processVideo(uri)
// and get back a result. No capture-specific logic belongs in here, and no
// processing logic belongs in the camera screen.
//
// Backend runs TRANSCRIBE then EXTRACT and returns both.

// Your computer's LAN IP, so the phone (on the same Wi-Fi) can reach the
// backend. Run `ipconfig` (Windows) / `ifconfig` (Mac/Linux) if this stops
// matching your network, and make sure the backend is running
// (`npm start` in backend/) and Windows Firewall allows Node on this port.
const BACKEND_URL = "http://192.168.1.105:3000";

/**
 * @param {string} videoUri local file uri of the recorded video
 * @returns {Promise<{
 *   sessionId: string,
 *   transcript: { text: string, segments: Array },
 *   extraction: {
 *     resume_additions: string[],
 *     founder_blurb: string,
 *     confidence_score: number,
 *     confidence_reasoning: string
 *   },
 *   videoEligible: boolean,
 *   confidenceThreshold: number
 * }>}
 */
export async function processVideo(videoUri) {
  console.log(`[processVideo] uploading ${videoUri} to ${BACKEND_URL}...`);

  const formData = new FormData();
  formData.append("video", {
    uri: videoUri,
    name: "intro.mp4",
    type: "video/mp4",
  });

  const res = await fetch(`${BACKEND_URL}/api/process-video`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Backend error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  console.log(
    `[processVideo] done — session ${data.sessionId}, confidence ${data.extraction?.confidence_score}`
  );
  return data;
}

/**
 * Records which extracted resume_additions the candidate actually confirmed
 * (the mobile checklist defaults to opt-out). Separate from processVideo()
 * since it's a follow-up action on an already-processed session, not part of
 * the capture->processing handoff.
 *
 * @param {string} sessionId
 * @param {string[]} confirmedAdditions
 */
export async function confirmAdditions(sessionId, confirmedAdditions) {
  console.log(`[confirmAdditions] session ${sessionId}: confirming ${confirmedAdditions.length} items...`);

  const res = await fetch(`${BACKEND_URL}/api/confirm-additions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, confirmedAdditions }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Backend error ${res.status}: ${errText}`);
  }

  return res.json();
}
