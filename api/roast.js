import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "url"' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const openai = new OpenAI({ apiKey });

  let htmlSnippet = '';
  try {
    const fetchRes = await fetch(url);
    const contentType = fetchRes.headers.get('content-type') || '';
    if (fetchRes.ok && contentType.includes('text/html')) {
      const text = await fetchRes.text();
      htmlSnippet = text.slice(0, 8000);
    }
  } catch {}

  const messages = [
    {
      role: 'system',
      content:
        'You are Gonki, a brutally honest but witty UX/code reviewer. You roast websites with sarcastic, specific feedback about their visual design, content, structure, and accessibility. Keep responses short (2–4 sentences).'
    },
    {
      role: 'user',
      content:
        `Roast this website.\nURL: ${url}\n\n` +
        `Here is part of its HTML (may be empty or truncated):\n\n` +
        `${htmlSnippet || '[HTML not available; infer from the URL and typical sites]'}\n\n` +
        `Return a single savage but playful roast, and explicitly include an "integrity score" in the form "NN/100" (1–100 where lower is worse).`
    }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages,
      temperature: 0.9,
      max_tokens: 350
    });

    const content = completion.choices?.[0]?.message?.content?.trim() || '';

    let scoreMatch = content.match(/(\d{1,3})\s*\/\s*100/);
    let score = scoreMatch ? parseInt(scoreMatch[1], 10) : NaN;
    if (Number.isNaN(score) || score < 1 || score > 100) {
      score = Math.floor(Math.random() * 40) + 1;
    }

    return res.status(200).json({
      score,
      roast: content
    });
  } catch (err) {
    console.error('OpenAI error:', err);
    const fallbackScore = Math.floor(Math.random() * 40) + 1;
    const fallbackRoast =
      'The AI choked on this site, which honestly might be the most accurate UX review possible.';
    return res.status(200).json({
      score: fallbackScore,
      roast: fallbackRoast
    });
  }
}
