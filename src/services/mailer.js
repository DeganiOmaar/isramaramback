const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (!transporter && process.env.MAILER_DSN) {
    try {
      transporter = nodemailer.createTransport(process.env.MAILER_DSN);
    } catch (err) {
      console.warn('Mailer config error:', err.message);
    }
  }
  return transporter;
};

const sendOtpEmail = async (email, code) => {
  const trans = getTransporter();
  if (!trans) {
    console.warn('[DEV] Mailer not configured. OTP for', email, ':', code);
    return { ok: true };
  }
  try {
    const fromMatch = process.env.MAILER_DSN?.match(/smtp:\/\/([^:]+)@/);
    const from = fromMatch ? fromMatch[1] : 'noreply@app.com';
    await trans.sendMail({
      from,
      to: email,
      subject: 'Votre code de vérification',
      text: `Votre code OTP est: ${code}. Valide 10 minutes.`,
      html: `<p>Votre code OTP est: <strong>${code}</strong></p><p>Valide 10 minutes.</p>`,
    });
    return { ok: true };
  } catch (err) {
    console.warn('[DEV] Email send failed:', err.message, '- OTP for', email, ':', code);
    return { ok: false, error: err.message };
  }
};

module.exports = { sendOtpEmail };
