import pdf from 'pdf-parse';

function normalizeAmount(value) {
  if (!value) return null;
  return Number(value.replace('.', '').replace(',', '.'));
}

function toIsoDate(date) {
  if (!date) return '';

  const match = date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return '';

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function detectProvider(text) {
  const upper = text.toUpperCase();

  if (upper.includes('WINDTRE')) return 'WINDTRE';
  if (upper.includes('ENEL')) return 'Enel';
  if (upper.includes('HERA')) return 'Hera';
  if (upper.includes('TIM')) return 'TIM';

  return 'Fornitore non trovato';
}

function detectCategory(text) {
  const upper = text.toUpperCase();

  if (
    upper.includes('BOLLETTA') ||
    upper.includes('LUCE') ||
    upper.includes('GAS') ||
    upper.includes('TELEFONICO')
  ) {
    return 'Casa';
  }

  return 'Altro';
}

export default async function handler(req, res) {
  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    const pdfData = await pdf(buffer);

    const text = pdfData.text;

    const dueDateMatch =
      text.match(/data\s+di\s+scadenza\s+(\d{2}\/\d{2}\/\d{4})/i);

    const amountMatch =
      text.match(/importo\s+da\s+pagare\s+euro\s+([\d.,]+)/i);

    const provider = detectProvider(text);
    const category = detectCategory(text);

    return res.status(200).json({
      result: {
        title: `Conto ${provider}`,
        provider,
        category,
        dueDate: toIsoDate(dueDateMatch?.[1]),
        amount: normalizeAmount(amountMatch?.[1]),
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'PDF parsing failed',
    });
  }
}
