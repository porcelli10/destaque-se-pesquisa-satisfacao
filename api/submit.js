export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nome, email, nps, csat, automacao, suporte, facilidade, comentario } = req.body;

  const npsNum = parseInt(nps);
  let categoria, prioridade, badge;

  if (npsNum >= 9) {
    categoria  = 'PROMOTOR';
    prioridade = 4;   // ClickUp: low
    badge      = '🟢';
  } else if (npsNum >= 7) {
    categoria  = 'NEUTRO';
    prioridade = 3;   // ClickUp: normal
    badge      = '🟡';
  } else {
    categoria  = 'DETRATOR';
    prioridade = 1;   // ClickUp: urgent
    badge      = '🔴';
  }

  const stars = (n) => '⭐'.repeat(Math.max(0, Math.min(5, parseInt(n) || 0)));

  const taskName = `${badge} [${categoria}] ${nome || 'Anônimo'} — NPS ${nps}/10`;

  const description = [
    `## Pesquisa de Satisfação — Destaque-se`,
    ``,
    `**Respondente:** ${nome || '*(não informado)*'}`,
    `**E-mail:** ${email || '*(não informado)*'}`,
    ``,
    `---`,
    ``,
    `### 📊 NPS (Probabilidade de Recomendação)`,
    `Nota **${nps}/10** → Classificação: **${categoria}**`,
    ``,
    `### ⭐ Satisfação Geral (CSAT)`,
    `${stars(csat)}  ${csat}/5`,
    ``,
    `### 🤖 Qualidade da Automação com IA`,
    `${stars(automacao)}  ${automacao}/5`,
    ``,
    `### 🎧 Suporte e Atendimento`,
    `${stars(suporte)}  ${suporte}/5`,
    ``,
    `### 🖥️ Facilidade de Uso`,
    `${stars(facilidade)}  ${facilidade}/5`,
    ``,
    `---`,
    ``,
    `### 💬 Comentário`,
    comentario ? comentario : '*(sem comentário)*',
  ].join('\n');

  const apiKey = process.env.CLICKUP_API_KEY;
  const listId = process.env.CLICKUP_LIST_ID;

  if (!apiKey || !listId) {
    console.warn('ClickUp not configured — CLICKUP_API_KEY and CLICKUP_LIST_ID must be set as env vars in Vercel.');
    return res.status(200).json({ success: true, warning: 'ClickUp not configured' });
  }

  try {
    const clickupRes = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: taskName,
        description,
        priority: prioridade,
        tags: ['pesquisa-satisfacao', categoria.toLowerCase()],
        notify_all: categoria === 'DETRATOR',
      }),
    });

    if (!clickupRes.ok) {
      const errText = await clickupRes.text();
      console.error('ClickUp API error:', clickupRes.status, errText);
      return res.status(200).json({ success: true, clickup_error: errText });
    }

    const task = await clickupRes.json();
    return res.status(200).json({ success: true, task_id: task.id });

  } catch (err) {
    console.error('Unexpected error calling ClickUp:', err);
    return res.status(200).json({ success: true, error: err.message });
  }
}
