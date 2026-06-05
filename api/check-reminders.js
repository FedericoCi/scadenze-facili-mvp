import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function formatDate(date) {
  if (!date) return 'Data non indicata';

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

function formatAmount(amount) {
  if (amount === null || amount === undefined || amount === '') {
    return 'Importo non indicato';
  }

  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(amount));
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toIsoDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!process.env.VITE_SUPABASE_URL) {
      return res.status(500).json({
        error: 'VITE_SUPABASE_URL mancante su Vercel',
      });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        error: 'SUPABASE_SERVICE_ROLE_KEY mancante su Vercel',
      });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({
        error: 'RESEND_API_KEY mancante su Vercel',
      });
    }

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const resend = new Resend(process.env.RESEND_API_KEY);

    const today = new Date();
    const targetDate = addDays(today, 7);
    const targetDateIso = toIsoDateOnly(targetDate);

    const { data: deadlines, error } = await supabaseAdmin
      .from('deadlines')
      .select('*')
      .eq('due_date', targetDateIso)
      .is('reminder_sent_at', null)
      .not('user_email', 'is', null);

    if (error) {
      console.error('Errore lettura scadenze:', error);

      return res.status(500).json({
        error: error.message,
      });
    }

    let sent = 0;

    for (const deadline of deadlines || []) {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: deadline.user_email,
        subject: `Promemoria: ${deadline.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h1>ScadenzeFacili</h1>

            <p>Ciao,</p>

            <p>ti ricordiamo questa scadenza:</p>

            <div style="padding: 16px; border: 1px solid #ddd; border-radius: 12px; margin: 16px 0;">
              <h2 style="margin-top: 0;">${deadline.title}</h2>

              <p><strong>Fornitore:</strong> ${deadline.provider || 'Non indicato'}</p>
              <p><strong>Categoria:</strong> ${deadline.category || 'Altro'}</p>
              <p><strong>Scadenza:</strong> ${formatDate(deadline.due_date)}</p>
              <p><strong>Importo:</strong> ${formatAmount(deadline.amount)}</p>
            </div>

            <p>Apri ScadenzeFacili per controllare o aggiornare la scadenza.</p>
          </div>
        `,
      });

      const { error: updateError } = await supabaseAdmin
        .from('deadlines')
        .update({
          reminder_sent_at: new Date().toISOString(),
        })
        .eq('id', deadline.id);

      if (updateError) {
        console.error('Errore update reminder_sent_at:', updateError);
      }

      sent += 1;
    }

    return res.status(200).json({
      checkedDate: targetDateIso,
      found: deadlines?.length || 0,
      sent,
    });
  } catch (error) {
    console.error('Errore check-reminders:', error);

    return res.status(500).json({
      error: error.message || 'Errore sconosciuto',
    });
  }
}