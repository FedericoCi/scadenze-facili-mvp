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

const dueDateMatch = text.match(
  /(\d{2}\/\d{2}\/\d{4})/g
);

const dueDate =
  dueDateMatch?.[dueDateMatch.length - 1] || '';

const amountMatch = text.match(
  /Euro\s+([\d,]+)/i
);

const amount = amountMatch?.[1] || null;

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