export const config = {
  api: {
    bodyParser: false,
  },
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function setCorsHeaders(res) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

function toIsoDate(value) {
  if (!value) return '';

  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);

  if (!match) return '';

  const [, day, month, year] = match;

  return `${year}-${month}-${day}`;
}

function normalizeAmount(value) {
  if (!value) return null;

  return Number(
    value
      .replace(/\./g, '')
      .replace(',', '.')
  );
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const rawBody = Buffer.concat(chunks);

    if (!rawBody.length) {
      return res.status(400).json({
        error: 'Missing PDF file',
      });
    }

    let buffer = rawBody;
    let fileName = 'document.pdf';
    let mimeType = 'application/pdf';

    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      const json = JSON.parse(rawBody.toString('utf8'));

      if (!json.fileBase64) {
        return res.status(400).json({
          error: 'Missing fileBase64',
        });
      }

      buffer = Buffer.from(json.fileBase64, 'base64');
      fileName = json.fileName || 'document.pdf';
      mimeType = json.mimeType || 'application/pdf';
    }

    const formData = new FormData();

    const blob = new Blob([buffer], {
      type: mimeType,
    });

    formData.append('file', blob, fileName);
    formData.append('apikey', process.env.OCR_SPACE_API_KEY);
    formData.append('language', 'ita');
    formData.append('isOverlayRequired', 'false');

    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    const ocrData = await ocrResponse.json();

    const text = ocrData?.ParsedResults?.[0]?.ParsedText || '';

    const upperText = text.toUpperCase();

    const provider = upperText.includes('WINDTRE')
      ? 'WINDTRE'
      : upperText.includes('ENEL')
        ? 'Enel'
        : upperText.includes('TIM')
          ? 'TIM'
          : upperText.includes('VODAFONE')
            ? 'Vodafone'
            : 'Fornitore non trovato';

    const dueDateMatch =
      text.match(/Data di scadenza[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i) ||
      text.match(/scadenza[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i);

    const amountMatch =
      text.match(/Importo da pagare[\s\S]*?Euro\s*([\d.,]+)/i) ||
      text.match(/Totale da pagare[\s\S]*?Euro\s*([\d.,]+)/i) ||
      text.match(/Euro\s*([\d.,]+)/i) ||
      text.match(/([\d.,]+)\s*€/i);

    const dueDate = toIsoDate(dueDateMatch?.[1]);
    const amount = normalizeAmount(amountMatch?.[1]);

    return res.status(200).json({
      result: {
        title:
          provider === 'WINDTRE'
            ? 'Conto telefonico WINDTRE'
            : provider !== 'Fornitore non trovato'
              ? `Scadenza ${provider}`
              : 'PDF letto',
        provider,
        category: 'Casa',
        dueDate,
        amount,
        debugText: text.slice(0, 3000),
      },
    });
  } catch (error) {
    console.error('Errore parse-pdf:', error);

    return res.status(500).json({
      error: 'PDF extraction failed',
      details: String(error.message || error),
    });
  }
}