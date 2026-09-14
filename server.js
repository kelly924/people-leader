const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '200kb' }));

const ACCESS_CODE = process.env.ACCESS_CODE;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MAX_MESSAGE_CHARS = 4000;
const MAX_MESSAGES = 30;

if (!ACCESS_CODE) {
  console.warn('Warning: ACCESS_CODE is not set. Every request will be rejected until it is.');
}
if (!ANTHROPIC_API_KEY) {
  console.warn('Warning: ANTHROPIC_API_KEY is not set. /api/assistant will fail until it is.');
}

// -----------------------------------------------------------------------
// CONTENT
// Edit this object to replace the placeholder text with Saint Bernard's
// real policies and how-to guides. Each entry needs an id, a title, and a
// body. The body supports plain line breaks (rendered as paragraphs).
// This is the ONLY place you need to edit to change what managers see in
// the reference library. The assistant is given this same content as
// context, so updating it here also updates what the assistant knows.
// -----------------------------------------------------------------------
const CONTENT = {
  policies: [
    {
      id: 'pto',
      title: 'PTO & Time Off',
      body: `[Placeholder — replace with Saint Bernard's real PTO policy.]

Full-time employees accrue paid time off starting on their first day. Request time off at least two weeks in advance through [your HR system]. Managers should approve or flag conflicts within three business days.`,
    },
    {
      id: 'benefits',
      title: 'Benefits Overview',
      body: `[Placeholder — replace with Saint Bernard's real benefits summary.]

Covers health, dental, and vision plans, retirement matching, and any wellness or education stipends. Link out to the full benefits guide and open enrollment dates here.`,
    },
    {
      id: 'conduct',
      title: 'Code of Conduct',
      body: `[Placeholder — replace with Saint Bernard's real code of conduct.]

Expectations for professional behavior, conflicts of interest, and how to report a concern. Note who to contact (HR, a specific person, or an anonymous line) if a manager needs to escalate something.`,
    },
    {
      id: 'remote-work',
      title: 'Remote Work Policy',
      body: `[Placeholder — replace with Saint Bernard's real remote/hybrid policy.]

Which roles are remote-eligible, expected core hours, equipment stipends, and how attendance for in-office days is tracked, if applicable.`,
    },
  ],
  howtos: [
    {
      id: 'one-on-ones',
      title: 'Running a Great 1:1',
      body: `[Placeholder — replace or expand with Saint Bernard's own guidance.]

Keep a running shared doc so both sides can add topics ahead of time. Spend the first few minutes on the person, not the task list. Leave time at the end for them to raise anything you haven't covered.`,
    },
    {
      id: 'performance-reviews',
      title: 'Writing a Performance Review',
      body: `[Placeholder — replace with Saint Bernard's actual review process and timeline.]

Lead with specific examples, not general impressions. Separate what happened from how it landed. Every piece of critical feedback should come with what "better" would have looked like.`,
    },
    {
      id: 'difficult-conversations',
      title: 'Handling a Difficult Conversation',
      body: `[Placeholder — replace with Saint Bernard's own guidance.]

Say the hard thing early in the conversation rather than burying it. Stick to observable behavior and impact. Agree on a concrete next step before the conversation ends.`,
    },
    {
      id: 'hiring',
      title: 'Hiring & Interviewing',
      body: `[Placeholder — replace with Saint Bernard's real hiring process.]

Who needs to be looped in at each stage, how scorecards are shared, and turnaround expectations for giving candidates a decision.`,
    },
  ],
};

function contentAsContext() {
  const section = (label, items) =>
    `${label}:\n` +
    items.map((i) => `- ${i.title}: ${i.body.replace(/\s+/g, ' ').trim()}`).join('\n');
  return [section('Policies', CONTENT.policies), section('How-To Guides', CONTENT.howtos)].join('\n\n');
}

function requireCode(req, res) {
  const { code } = req.body || {};
  if (!ACCESS_CODE || code !== ACCESS_CODE) {
    res.status(401).json({ error: 'That access code is not correct.' });
    return false;
  }
  return true;
}

app.post('/api/verify', (req, res) => {
  if (!requireCode(req, res)) return;
  res.json({ ok: true });
});

app.post('/api/content', (req, res) => {
  if (!requireCode(req, res)) return;
  res.json(CONTENT);
});

app.post('/api/assistant', async (req, res) => {
  if (!requireCode(req, res)) return;

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No message provided.' });
  }
  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: 'This conversation has gotten too long — start a new one.' });
  }
  for (const m of messages) {
    if (!m || typeof m.content !== 'string' || !m.content.trim()) {
      return res.status(400).json({ error: 'Empty message.' });
    }
    if (m.content.length > MAX_MESSAGE_CHARS) {
      return res.status(400).json({ error: `Keep each message under ${MAX_MESSAGE_CHARS} characters.` });
    }
  }

  const sanitized = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        system: [
          "You are the Manager Resources assistant for Saint Bernard's internal manager site.",
          'You help managers in two ways: answering questions about company policy and process, and helping draft written communications (performance reviews, PIP language, announcements, difficult messages to a direct report, etc).',
          "Below is the company's current reference content. Ground policy answers in it, and say so plainly when a question isn't covered by it rather than guessing or inventing a specific policy detail.",
          '---',
          contentAsContext(),
          '---',
          'When drafting something, ask for any missing specifics you genuinely need (names, dates, the situation) rather than inventing them, keep the tone direct and human rather than corporate, and keep critical feedback specific and behavior-based.',
          'Keep responses focused and no longer than necessary.',
        ].join('\n'),
        messages: sanitized,
      }),
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      console.error('Anthropic API error:', data);
      return res.status(502).json({ error: 'Something went wrong generating that. Try again in a moment.' });
    }

    const reply = (data.content || []).find((b) => b.type === 'text')?.text || '';
    res.json({ reply: reply.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our end. Try again in a moment.' });
  }
});

// Static files last, so the API routes above always take priority.
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
