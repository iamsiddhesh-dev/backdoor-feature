// EXTRACT step: transcript (text) -> structured signal JSON via an LLM.
// Isolated on purpose — processVideo() will call this after transcription,
// regardless of whether the video came from the camera screen or, later,
// a WhatsApp capture layer.
//
// Uses Groq's OpenAI-compatible chat completions endpoint.

require("dotenv").config();

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const EXTRACTION_SYSTEM_PROMPT = `You are an extraction engine for "Backdoor Video Signal", a feature that turns a
candidate's short self-introduction video into structured hiring signal for
startup founders.

You will receive a transcript of the candidate speaking. Extract ONLY what is
useful for evaluating them as a startup hire, and return ONLY the JSON object
described below — no prose, no markdown fences, no commentary.

STRICT RULES (violating these makes the output unusable):
1. CONSERVATIVE EXTRACTION ONLY. Never invent, infer, embellish, or round up
   any fact — company names, titles, metrics, dates, schools, skills,
   motivations — that was not actually said. If something is ambiguous or
   only implied, leave it out rather than guess.
2. Do not pad with generic praise ("great communicator", "seems passionate")
   unless the candidate said something specific that supports it.
3. Every item in "resume_additions" must be traceable to a specific phrase in
   the transcript. Prefer near-verbatim facts over paraphrase when precision
   matters (e.g. employer names, tools, metrics).
4. "resume_additions" should surface things a typical resume bullet would
   MISS — motivation, context behind a project, why they want this kind of
   role, soft signals stated explicitly — not just restate obvious resume
   lines like job titles/dates unless the video adds detail a resume wouldn't
   normally carry.
5. "confidence_score" reflects how much concrete, verifiable, differentiated
   signal the transcript contains (specific projects, named companies, real
   metrics, clear reasoning) versus vague/generic filler. A transcript that is
   short, generic, or vague should score low even if the tone is confident.
   It MUST be an integer from 0 to 100 (e.g. 82), never a decimal like 0.8 and
   never a fraction — 0 means no usable signal, 100 means maximally concrete
   and differentiated signal.
6. If the transcript contains little or no usable signal, return short/empty
   arrays and a low confidence_score rather than fabricating content to fill
   the schema.
7. "email_hooks" must be short, concrete lines a founder could paste into a
   cold outreach email — reference specific things the candidate said, not
   generic flattery.
8. "founder_blurb" must NEVER be an empty string, even when the transcript is
   thin or low-signal. If there is little concrete signal, write an honest
   2-3 sentence summary that reflects that thinness (e.g. describes tone and
   the few facts stated) rather than leaving it blank or inventing substance.

OUTPUT FORMAT — return exactly this JSON shape, no extra keys:
{
  "resume_additions": string[],
  "founder_blurb": string,
  "confidence_score": integer (0-100, NOT a decimal fraction),
  "confidence_reasoning": string,
  "email_hooks": string[]
}`;

/**
 * @param {string} transcript
 * @returns {Promise<object>} parsed extraction JSON
 */
async function extractSignal(transcript) {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: `Transcript:\n"""${transcript}"""` },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const raw = data.choices[0].message.content.trim();
  return JSON.parse(raw);
}

module.exports = { extractSignal, EXTRACTION_SYSTEM_PROMPT };
