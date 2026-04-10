import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn("[Email] RESEND_API_KEY not configured. Email features will be disabled.");
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Use verified domain if available, otherwise fallback to Resend's default
const FROM_EMAIL = "ZEAL <noreply@zealtecnologia.com>";
const FROM_EMAIL_FALLBACK = "ZEAL <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return resend !== null;
}

/**
 * Send password reset email directly to the user
 */
export async function sendPasswordResetEmail(
  to: string,
  userName: string,
  resetUrl: string
): Promise<boolean> {
  if (!resend) {
    console.warn("[Email] Resend not configured, cannot send password reset email");
    return false;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0f; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellspacing="0" cellpadding="0" style="background-color: #111118; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                🦷 Zeal
              </h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">
                Assistente de IA Odontol&oacute;gico
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #ffffff;">
                Recupera&ccedil;&atilde;o de Senha
              </h2>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #9ca3af;">
                Ol&aacute; <strong style="color: #ffffff;">${userName}</strong>,<br><br>
                Recebemos uma solicita&ccedil;&atilde;o para redefinir a senha da sua conta. Clique no bot&atilde;o abaixo para criar uma nova senha:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${resetUrl}" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 12px; letter-spacing: 0.3px;">
                      Redefinir minha senha
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.6; color: #6b7280;">
                Se o bot&atilde;o n&atilde;o funcionar, copie e cole o link abaixo no seu navegador:
              </p>
              <p style="margin: 0 0 24px; padding: 12px; background-color: rgba(255,255,255,0.03); border-radius: 8px; font-size: 12px; color: #7c3aed; word-break: break-all; border: 1px solid rgba(124,58,237,0.2);">
                ${resetUrl}
              </p>

              <!-- Warning -->
              <div style="padding: 16px; background-color: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.15); border-radius: 10px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #d97706;">
                  ⚠️ Este link expira em <strong>1 hora</strong>. Se voc&ecirc; n&atilde;o solicitou esta recupera&ccedil;&atilde;o, ignore este e-mail.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #4b5563;">
                &copy; ${new Date().getFullYear()} Zeal Tecnologia. Todos os direitos reservados.
              </p>
              <p style="margin: 8px 0 0; font-size: 11px; color: #374151;">
                Este &eacute; um e-mail autom&aacute;tico. N&atilde;o responda a esta mensagem.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textContent = `Olá ${userName},

Recebemos uma solicitação para redefinir a senha da sua conta no ZEAL.

Clique no link abaixo para criar uma nova senha:
${resetUrl}

Este link expira em 1 hora. Se você não solicitou esta recuperação, ignore este e-mail.

© ${new Date().getFullYear()} Zeal Tecnologia`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: "🔑 Recuperação de Senha - ZEAL",
      html: htmlContent,
      text: textContent,
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      
      // If domain not verified, try fallback
      if (error.message?.includes("not verified") || error.message?.includes("not found")) {
        console.log("[Email] Trying fallback sender...");
        const fallback = await resend.emails.send({
          from: FROM_EMAIL_FALLBACK,
          to: [to],
          subject: "🔑 Recuperação de Senha - ZEAL",
          html: htmlContent,
          text: textContent,
        });
        
        if (fallback.error) {
          console.error("[Email] Fallback also failed:", fallback.error);
          return false;
        }
        
        console.log("[Email] Password reset email sent via fallback to:", to, "ID:", fallback.data?.id);
        return true;
      }
      
      return false;
    }

    console.log("[Email] Password reset email sent to:", to, "ID:", data?.id);
    return true;
  } catch (err: any) {
    console.error("[Email] Failed to send password reset email:", err.message);
    return false;
  }
}
