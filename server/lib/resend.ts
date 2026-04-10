import { ENV } from "../_core/env";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Zeal Dental AI <onboarding@resend.dev>",
      to: [options.to],
      subject: options.subject,
      html: options.html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API error ${response.status}: ${errorBody}`);
  }
}

export function buildPasswordResetEmail(name: string, resetUrl: string): string {
  const year = new Date().getFullYear();
  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recuperação de Senha</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f5; padding: 40px 0;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr><td style="background: #0f172a; padding: 32px 40px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Zeal Dental AI</h1>
          </td></tr>
          <tr><td style="padding: 40px 40px 32px;">
            <h2 style="color: #0f172a; font-size: 20px; margin: 0 0 12px;">Recuperação de senha</h2>
            <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Olá, <strong>${name}</strong>.</p>
            <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
              Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.
              Este link é válido por <strong>1 hora</strong>.
            </p>
            <div style="text-align: center; margin-bottom: 28px;">
              <a href="${resetUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
                Redefinir minha senha
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0 0 8px;">
              Se o botão não funcionar, copie e cole este link no seu navegador:
            </p>
            <p style="color: #64748b; font-size: 12px; word-break: break-all; margin: 0 0 28px;">
              <a href="${resetUrl}" style="color: #3b82f6;">${resetUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin-bottom: 24px;">
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">
              Se você não solicitou a recuperação de senha, ignore este email. Sua senha permanece a mesma.
            </p>
          </td></tr>
          <tr><td style="background: #f8fafc; padding: 20px 40px; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${year} Zeal Dental AI. Todos os direitos reservados.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>
  `;
}
