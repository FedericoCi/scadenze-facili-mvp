export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text' });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content:
              'Sei un estrattore di scadenze per documenti italiani. Estrai i dati dal testo. Se trovi "Data di scadenza", usala come dueDate. Se trovi "Importo da pagare Euro", usalo come amount. Il provider è il fornitore del servizio, per esempio WINDTRE, Enel, Hera, UnipolSai. Restituisci date in formato YYYY-MM-DD e importi come numero decimale.',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'deadline_extraction',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                provider: { type: 'string' },
                category: {
                  type: 'string',
                  enum: ['Casa', 'Auto', 'Documenti', 'Altro'],
                },
                dueDate: { type: 'string' },
                amount: { type: ['number', 'null'] },
              },
              required: ['title', 'provider', 'category', 'dueDate', 'amount'],
            },
          },
        },
        temperature: 0,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(data);
      return res.status(500).json({
        error: 'OpenAI request failed',
        details: data,
      });
    }

    const content = data.output_text || '{}';
    const result = JSON.parse(content);

    return res.status(200).json({ result });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Extraction failed',
    });
  }
}