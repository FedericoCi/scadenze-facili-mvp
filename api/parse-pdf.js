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

    return res.status(200).json({
      result: {
        title: text ? 'PDF letto' : 'PDF non leggibile',
        provider: 'Fornitore non trovato',
        category: 'Altro',
        dueDate: '',
        amount: null,
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