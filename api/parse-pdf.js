export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  return res.status(200).json({
    result: {
      title: 'Dati non trovati',
      provider: 'Fornitore non trovato',
      category: 'Altro',
      dueDate: '',
      amount: null,
      debugText: 'PDF parsing temporaneamente disattivato',
    },
  });
}