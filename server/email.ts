import type { Env } from './env'

type Mail = { to: string; subject: string; text: string; html: string }

export function mailConfigured(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY || env.MAILPIT_URL)
}

// Sends through Resend in production (any recipient domain works — Gmail,
// company domains, GMX, …). Locally, Mailpit catches everything. With
// neither configured the message is only logged so links stay reachable.
export async function sendMail(env: Env, mail: Mail): Promise<void> {
  const from = env.MAIL_FROM || 'Engineering Office <no-reply@example.com>'

  if (env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`resend failed: ${res.status} ${body.slice(0, 200)}`)
    }
    return
  }

  if (env.MAILPIT_URL) {
    const res = await fetch(`${env.MAILPIT_URL.replace(/\/$/, '')}/api/v1/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        From: parseAddress(from),
        To: [{ Email: mail.to }],
        Subject: mail.subject,
        Text: mail.text,
        HTML: mail.html,
      }),
    })
    if (!res.ok) throw new Error(`mailpit failed: ${res.status}`)
    return
  }

  console.warn(`[mail] no provider configured — to=${mail.to} subject="${mail.subject}"\n${mail.text}`)
}

function parseAddress(s: string): { Email: string; Name?: string } {
  const m = s.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  return m ? { Name: m[1] || undefined, Email: m[2] } : { Email: s.trim() }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

// Plain, German-language templates matching the app's UI language.
export function linkMail(opts: { to: string; subject: string; intro: string; cta: string; link: string; outro?: string }): Mail {
  const outro = opts.outro ?? 'Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.'
  return {
    to: opts.to,
    subject: opts.subject,
    text: `${opts.intro}\n\n${opts.cta}: ${opts.link}\n\n${outro}\n`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111">
<p>${escapeHtml(opts.intro)}</p>
<p><a href="${escapeHtml(opts.link)}" style="display:inline-block;padding:8px 14px;background:#111;color:#fff;border-radius:6px;text-decoration:none">${escapeHtml(opts.cta)}</a></p>
<p style="color:#666;font-size:12px">${escapeHtml(outro)}<br>${escapeHtml(opts.link)}</p>
</div>`,
  }
}

export function appUrl(env: Env, request: Request): string {
  return (env.APP_URL || new URL(request.url).origin).replace(/\/$/, '')
}
