import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  try {
    const { email } = req.body;

    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Test ScadenzeFacili',
      html: `
        <h1>ScadenzeFacili</h1>
        <p>Questa è la tua prima email di test.</p>
        <p>Se la stai leggendo, l'invio funziona 🎉</p>
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