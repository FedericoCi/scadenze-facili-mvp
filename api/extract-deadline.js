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

  if (upper.includes('WINDTRE') || upper.includes('WIND TRE')) return 'WINDTRE';
  if (upper.includes('ENEL')) return 'Enel';
  if (upper.includes('HERA')) return 'Hera';
  if (upper.includes('UNIPOL')) return 'UnipolSai';
  if (upper.includes('TIM')) return 'TIM';
  if (upper.includes('VODAFONE')) return 'Vodafone';

  return 'Fornitore non trovato';
}

function detectCategory(text) {
  const upper = text.toUpperCase();

  if (
    upper.includes('CONTO TELEFONICO') ||
    upper.includes('TELEFONICO') ||
    upper.includes('INTERNET') ||
    upper.includes('LUCE') ||
    upper.includes('GAS') ||
    upper.includes('BOLLETTA')
  ) {
    return 'Casa';
  }

  if (
    upper.includes('AUTO') ||
    upper.includes('ASSICURAZIONE') ||
    upper.includes('BOLLO') ||
    upper.includes('REVISIONE')
  ) {
    return 'Auto';
  }

  if (
    upper.includes('CARTA D') ||
    upper.includes('PASSAPORTO') ||
    upper.includes('DOCUMENTO')
  ) {
    return 'Documenti';
  }

  return 'Altro';
}

function detectTitle(text, provider, category) {
  const upper = text.toUpperCase();

  if (upper.includes('CONTO TELEFONICO')) return `Conto telefonico ${provider}`;
  if (upper.includes('BOLLETTA')) return `Bolletta ${provider}`;
  if (upper.includes('ASSICURAZIONE')) return `Assicurazione ${provider}`;
  if (upper.includes('BOLLO')) return 'Bollo auto';
  if (upper.includes('REVISIONE')) return 'Revisione auto';

  return category === 'Casa' ? `Scadenza ${provider}` : 'Scadenza';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text' });
    }

    const dueDateMatch =
      text.match(/data\s+di\s+scadenza\s+(\d{2}\/\d{2}\/\d{4})/i) ||
      text.match(/scadenza\s+(\d{2}\/\d{2}\/\d{4})/i);

    const amountMatch =
      text.match(/importo\s+da\s+pagare\s+euro\s+([\d.,]+)/i) ||
      text.match(/totale\s+da\s+pagare\s+euro\s+([\d.,]+)/i) ||
      text.match(/importo\s+([\d.,]+)/i);

    const provider = detectProvider(text);
    const category = detectCategory(text);
    const dueDate = toIsoDate(dueDateMatch?.[1]);
    const amount = normalizeAmount(amountMatch?.[1]);
    const title = detectTitle(text, provider, category);

    return res.status(200).json({
      result: {
        title,
        provider,
        category,
        dueDate,
        amount,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Extraction failed',
    });
  }
}