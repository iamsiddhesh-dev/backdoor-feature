// Hardcoded sample transcripts for testing the extraction step in isolation,
// before any real camera/transcription pipeline exists.

module.exports = {
  rahul: `Hi, I am Rahul, a recent Computer Science graduate from Bits pilani with a
strong interest in quantitative finance and data-driven systems. I worked as
a quantitative analyst at Tower Research Capital where I built and analyzed
models, worked with large data sets and helped improve trading strategies
through statistical insights. I enjoy solving complex problems especially
where math, programming and real world impact intersect. My experience has
strengthened my ability to think analytically, optimize systems and turn raw
data into meaningful decisions. I am particularly interested in roles that
combine finance, machine learning and high performance computing and I am
always looking to build systems that are both efficient and impactful.`,

  vague: `Hey, my name's Sam. I'm a hard worker and a fast learner, I'm really
passionate about technology and I think I'd be a great fit for a startup. I've
done some coding projects in school and I'm excited about the opportunity to
grow and make an impact. I'm a team player and I love a good challenge.`,

  strong: `Hi, I'm Priya. I just graduated from IIT Bombay with a degree in
Electrical Engineering. Last summer I built a real-time fraud detection model
at Razorpay that cut false positives by 22% across their payments pipeline,
processing about 40,000 transactions a second. Outside of that I run a small
open-source project, a Postgres query optimizer plugin, that has about 600
stars on GitHub. I'm drawn to early-stage startups because I want to own a
problem end to end instead of a narrow slice of one, and because my dad ran a
small manufacturing business that failed when I was a teenager, which is part
of why I care so much about building things that actually survive contact
with real customers.`,

  // Whisper-style transcript of an unscripted spoken intro: filler words,
  // false starts, self-corrections, run-on sentences, no clean paragraph
  // structure. Same underlying facts as "strong" but delivered messily, to
  // check the prompt doesn't lose signal or invent structure that isn't there.
  messy: `Um hi, yeah so my name is, uh, Priya, and I, um, I just graduated,
like a few months ago, from IIT Bombay, um, in electrical engineering. And so
last summer, um, I was interning, well not really interning it was kind of a
full role, at Razorpay, and I, um, I built this, this fraud detection thing,
like a model, that runs in real time, and it, um, it cut down false positives
by, I think it was twenty two percent or somewhere around there, across their
whole, um, payments pipeline, and it was handling like forty thousand
transactions a second or something like that, I don't remember the exact
number. And then, um, outside of work I also, I run this open source thing,
it's a plugin for Postgres, um, for query optimization, and it's got like
six hundred stars on GitHub I think, maybe more now. And, um, why startups,
I guess, I don't know, I just, I really want to own a problem like end to
end, not just a small piece of it, and, um, also my dad, he had this small
manufacturing business and it, um, it failed when I was a teenager, so, um,
yeah that's kind of part of why I care so much about, like, building stuff
that actually, you know, survives contact with real customers, if that makes
sense.`,
};
