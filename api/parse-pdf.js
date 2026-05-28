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

    const pdfModule = await import('pdf-parse');
    const pdf = pdfModule.default || pdfModule;

    const pdfData = await pdf(buffer);
    const text = pdfData.text || '';

    console.log('PDF TEXT LENGTH:', text.length);
    console.log('PDF TEXT PREVIEW:', text.slice(0, 1000));

    return res.status(200).json({
      result: {
        title: text ? 'PDF letto' : 'PDF non leggibile',
        provider: 'Fornitore non trovato',
        category: 'Altro',
        dueDate: '',
        amount: null,
        debugText: text.slice(0, 500),
      },
    });
  } catch (error) {
    console.error('PDF parsing failed:', error);

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