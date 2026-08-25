const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function normalizeAmount(value) {
  if (!value) return null;

  return Number(value.replace('.', '').replace(',', '.'));
}

function toIsoDate(date) {
  if (!date) return '';

  const numericMatch = date.match(/(\d{2})\/(\d{2})\/(\d{4})/);

  if (numericMatch) {
    const [, day, month, year] = numericMatch;
    return `${year}-${month}-${day}`;
  }

  const monthMap = {
    gennaio: '01',
    febbraio: '02',
    marzo: '03',
    aprile: '04',
    maggio: '05',
    giugno: '06',
    luglio: '07',
    agosto: '08',
    settembre: '09',
    ottobre: '10',
    novembre: '11',
    dicembre: '12',
  };

  const textMatch = date
    .toLowerCase()
    .match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/);

  if (textMatch) {
    const [, day, monthName, year] = textMatch;
    const paddedDay = day.padStart(2, '0');
    const month = monthMap[monthName];

    return `${year}-${month}-${paddedDay}`;
  }

  return '';
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
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
      text.match(/scadenza\s+(\d{2}\/\d{2}\/\d{4})/i) ||
      text.match(/entro\s+il\s+(\d{1,2}\s+[a-zàèéìòù]+\s+\d{4})/i) ||
      text.match(/entro\s+(\d{1,2}\s+[a-zàèéìòù]+\s+\d{4})/i);

    const amountMatch =
      text.match(/importo\s+da\s+pagare\s+euro\s+([\d.,]+)/i) ||
      text.match(/totale\s+da\s+pagare\s+euro\s+([\d.,]+)/i) ||
      text.match(/pari\s+a\s+([\d.,]+)\s*€/i) ||
      text.match(/([\d.,]+)\s*€/i) ||
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