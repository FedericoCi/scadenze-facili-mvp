export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    const formData = new FormData();

    const blob = new Blob([buffer], {
      type: 'application/pdf',
    });

    formData.append('file', blob, 'document.pdf');
    formData.append('apikey', process.env.OCR_SPACE_API_KEY);
    formData.append('language', 'ita');
    formData.append('isOverlayRequired', 'false');

    const ocrResponse = await fetch(
      'https://api.ocr.space/parse/image',
      {
        method: 'POST',
        body: formData,
      }
    );

    const ocrData = await ocrResponse.json();

    const text =
      ocrData?.ParsedResults?.[0]?.ParsedText || '';

      const provider =
  text.toUpperCase().includes('WINDTRE')
    ? 'WINDTRE'
    : 'Fornitore non trovato';

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

const dueDateMatch =
  text.match(/Data di scadenza[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i);

const amountMatch =
  text.match(/Importo da pagare[\s\S]*?Euro\s*([\d.,]+)/i) ||
  text.match(/Euro\s*([\d.,]+)/i);

const dueDate = toIsoDate(dueDateMatch?.[1]);
const amount = normalizeAmount(amountMatch?.[1]);

    return res.status(200).json({
  result: {
    title: provider === 'WINDTRE'
      ? 'Conto telefonico WINDTRE'
      : 'PDF letto',
    provider,
    category: 'Casa',
    dueDate,
    amount,
    debugText: text.slice(0, 3000),
  },
});
  } catch (error) {
    return res.status(200).json({
      result: {
        title: 'PDF non leggibile',
        provider: 'Fornitore non trovato',
        category: 'Altro',
        dueDate: '',
        amount: null,
        debugText: String(error.message || error),
      },
    });
  }
}