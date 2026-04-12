export const runtime = 'nodejs';

function safeParseJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  // Try direct parse
  try { return JSON.parse(clean); } catch {}
  // Try extracting JSON object
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(clean.substring(start, end + 1)); } catch {}
  }
  return null;
}

export async function POST(req) {
  try {
    const { ticker, liveData } = await req.json();
    if (!ticker) return Response.json({ error: 'Ticker required' }, { status: 400 });

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const liveCtx = liveData
      ? `Live: $${liveData.price?.toFixed(2)}, change: ${liveData.change?.toFixed(2)}%, volume: ${((liveData.volume || 0) / 1e6).toFixed(1)}M`
      : 'No live data.';

    const system = `You are a quantitative analyst scoring Nasdaq stocks for a 3-engine trading framework. Today: ${today}.
ENGINE 1 (Anchor, hold 12mo): 0-10: cap>50B(2), FCF profitable(2), analyst>70%buy(2), rev>15%(2), AI trend(2)
ENGINE 2 (Swing, pre-earnings): 0-10: earnings in 2-8wks(3), beat 3+qtrs(2), down from high(2), target>20%(2), RSI<70(1)
ENGINE 3 (Flip, same-day): 0-10: fresh catalyst(4), vol>150%(3), gap>3%(2), momentum(1)
Respond ONLY with valid JSON, no markdown, no preamble:
{"ticker":"","e1":0,"e2":0,"e3":0,"verdict":"ENGINE_2","verdict_label":"Engine 2 — Swing","confidence":75,"e1_criteria":[{"name":"","pass":true,"detail":"","pts":2,"max":2}],"e2_criteria":[{"name":"","pass":true,"detail":"","pts":2,"max":3}],"e3_criteria":[{"name":"","pass":false,"detail":"","pts":0,"max":4}],"stop_loss":"","entry":"","migration":"","summary":""}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: `Score: ${ticker}\n${liveCtx}` }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const result = safeParseJSON(text);

    if (!result) {
      return Response.json({ error: 'Could not parse Claude response. Try again.', raw: text }, { status: 422 });
    }

    return Response.json({ result });
  } catch (err) {
    console.error('Score error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
