import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
  if (upper.includes('TIM')) return 'TIM';
  if (upper.includes('VODAFONE')) return 'Vodafone';

  return 'Fornitore non trovato';
}

function detectCategory(text) {
  const upper = text.toUpperCase();

  if (
    upper.includes('BOLLETTA') ||
    upper.includes('CONTO TELEFONICO') ||
    upper.includes('TELEFONICO') ||
    upper.includes('LUCE') ||
    upper.includes('GAS') ||
    upper.includes('INTERNET')
  ) {
    return 'Casa';
  }

  return 'Altro';
}

function detectTitle(text, provider) {
  const upper = text.toUpperCase();

  if (upper.includes('CONTO TELEFONICO')) return `Conto telefonico ${provider}`;
  if (upper.includes('BOLLETTA')) return `Bolletta ${provider}`;

  return provider !== 'Fornitore non trovato' ? `Scadenza ${provider}` : 'Scadenza';
}

async function extractTextFromPdf(buffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const pageText = content.items
      .map((item) => item.str)
      .join(' ');

    fullText += `\n${pageText}`;
  }

  return fullText;
}

export default async function handler(req, res) {
  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    const text = await extractTextFromPdf(buffer);

    console.log('PDFJS TEXT LENGTH:', text.length);
    console.log('PDFJS TEXT PREVIEW:', text.slice(0, 1000));

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
    const title = detectTitle(text, provider);

    if (!text.trim()) {
      return res.status(200).json({
        result: {
          title: 'PDF non leggibile',
          provider: 'Fornitore non trovato',
          category: 'Altro',
          dueDate: '',
          amount: null,
          debugText: '',
        },
      });
    }

    return res.status(200).json({
      result: {
        title,
        provider,
        category,
        dueDate,
        amount,
        debugText: text.slice(0, 500),
      },
    });
  } catch (error) {
    console.error('PDFJS parsing failed:', error);

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