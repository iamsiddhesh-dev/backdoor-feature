// Step 1 test harness: run the extraction step against hardcoded sample
// transcripts and print the resulting JSON for each.

const { extractSignal } = require("./extract");
const samples = require("./samples");

async function main() {
  for (const [name, transcript] of Object.entries(samples)) {
    console.log(`\n=== SAMPLE: ${name} ===`);
    try {
      const result = await extractSignal(transcript);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(`Extraction failed for "${name}":`, err.message);
    }
  }
}

main();
