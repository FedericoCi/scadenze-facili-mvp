import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function formatDate(date) {
  if (!date) return 'Data non indicata';

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

function formatAmount(amount) {
  if (amount === null || amount === undefined || amount === '') return 'Importo non indicato';

  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(amount));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, deadline } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email mancante' });
    }

    if (!deadline) {
      return res.status(400).json({ error: 'Scadenza mancante' });
    }

    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: `Promemoria: ${deadline.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h1>ScadenzeFacili</h1>

          <p>Ciao,</p>

          <p>
            ti ricordiamo questa scadenza:
          </p>

          <div style="padding: 16px; border: 1px solid #ddd; border-radius: 12px; margin: 16px 0;">
            <h2 style="margin-top: 0;">${deadline.title}</h2>

            <p><strong>Fornitore:</strong> ${deadline.provider || 'Non indicato'}</p>
            <p><strong>Categoria:</strong> ${deadline.category || 'Altro'}</p>
            <p><strong>Scadenza:</strong> ${formatDate(deadline.dueDate)}</p>
            <p><strong>Importo:</strong> ${formatAmount(deadline.amount)}</p>
          </div>

          <p>
            Apri ScadenzeFacili per controllare o aggiornare la scadenza.
          </p>
        </div>
      `,
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message,
    });
  }
}