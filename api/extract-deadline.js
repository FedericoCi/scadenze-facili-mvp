export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  try {

    const { text } = req.body;

    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'system',
              content: `
Estrarre da un documento:
- titolo
- fornitore
- categoria
- data scadenza
- importo

Rispondi SOLO in JSON valido.

Esempio:
{
  "title": "Bolletta luce",
  "provider": "Enel",
  "category": "Casa",
  "dueDate": "2026-06-20",
  "amount": 84.50
}
              `,
            },
            {
              role: 'user',
              content: text,
            },
          ],
          temperature: 0.2,
        }),
      }
    );

    const data = await response.json();

    const content =
      data.choices?.[0]?.message?.content || '{}';

    return res.status(200).json({
      result: JSON.parse(content),
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: 'Extraction failed',
    });
  }
}