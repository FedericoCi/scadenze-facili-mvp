import { DOMMatrix, ImageData, Path2D } from 'canvas';

globalThis.DOMMatrix = DOMMatrix;
globalThis.ImageData = ImageData;
globalThis.Path2D = Path2D;


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

    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;

    let text = '';

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      text += content.items.map((item) => item.str).join(' ');
    }

    return res.status(200).json({
      result: {
        title: text ? 'PDF letto' : 'PDF non leggibile',
        provider: 'Fornitore non trovato',
        category: 'Altro',
        dueDate: '',
        amount: null,
        debugText: text.slice(0, 1000),
      },
    });
  } catch (error) {
    console.error('PDFJS error:', error);

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