/**
 * Transactional email — templates + Resend send + email_log persistence.
 *
 * Every send writes a row to email_log:
 *   pending → on attempt
 *   sent    → with provider_message_id when Resend confirms
 *   failed  → with error string
 *
 * Callers do NOT need to block on delivery — wrap sendEmail() in a
 * fire-and-forget if speed matters. The email_log row is created
 * inside this function, so even a failed send is recorded.
 */

const { authHeaders } = require('./supabase-rest')

const FROM = () => process.env.INVITE_FROM_EMAIL || 'Owlry <hello@example.com>'
const RESEND_KEY = () => process.env.RESEND_API_KEY

/* ─── Template registry ──────────────────────────────────────────────────── */

function formatSeat(tier, n) {
  if (n == null) return ''
  if (tier === 'founding') return `Seat #${String(n).padStart(2, '0')}`
  return `Seat #${n}`
}

function shellHTML(innerHTML) {
  return `
<!doctype html><html><body style="margin:0;padding:0;background:#f6f0e6;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background:#f6f0e6;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffaf2;border:1px solid rgba(28,24,18,0.16);border-radius:14px;">
        <tr><td style="padding:32px 36px;font-family:Georgia,'Times New Roman',serif;color:#1c1812;line-height:1.55;">
          <div style="text-align:center;font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:22px;letter-spacing:0.02em;margin-bottom:24px;">
            Owlpo · The Owl's Postoffice
          </div>
          ${innerHTML}
        </td></tr>
      </table>
      <p style="font-family:Georgia,serif;font-size:12px;color:#7a6f63;margin-top:18px;">
        Sent by Owlpo. Your reading is yours — we don't sell your address.
      </p>
    </td></tr>
  </table>
</body></html>`
}

function codeListHTML(codes) {
  return `
  <table cellspacing="0" cellpadding="0" style="margin:18px 0;width:100%;">
    ${codes
      .map(
        (c) => `
      <tr><td style="padding:8px 12px;background:#fdf7ec;border:1px solid rgba(28,24,18,0.1);border-radius:8px;font-family:'Courier New',monospace;font-weight:700;letter-spacing:0.08em;font-size:15px;">
        ${c}
      </td></tr>
      <tr><td style="height:6px;"></td></tr>`
      )
      .join('')}
  </table>`
}

const T = {
  signup_free: {
    en: ({ name, seat, codes }) => ({
      subject: `${seat} — your dispatch begins`,
      html: shellHTML(`
        <p>Welcome home, <strong>${name}</strong>.</p>
        <p>Your seat is <strong>${seat}</strong>. The right book finds you — we'll write when it's time.</p>
        <p>Three private invitations are yours to share. Each one used moves you and your friend up by 5 spots:</p>
        ${codeListHTML(codes)}
        <p>Share them anywhere. Your shelf, your terms.</p>
      `),
    }),
    zh: ({ name, seat, codes }) => ({
      subject: `${seat} — 您的座位已就位`,
      html: shellHTML(`
        <p>欢迎回家，<strong>${name}</strong>。</p>
        <p>您的座位号是 <strong>${seat}</strong>。合适的书会找到您 — 时机到时，我们会致信。</p>
        <p>这是您的三枚私人邀请。每被使用一次，您和被邀请者各前移 5 位：</p>
        ${codeListHTML(codes)}
        <p>随心分享 — 您的书架，您做主。</p>
      `),
    }),
  },

  signup_founding: {
    en: ({ name, seat, codes }) => ({
      subject: `${seat} — welcome home, founding member`,
      html: shellHTML(`
        <p>Welcome home, <strong>${name}</strong>.</p>
        <p>Your founding seat is <strong>${seat}</strong>. The wax is warm; the door is yours.</p>
        <p>Ten invitations are minted in your name. Each activation moves you up by 1 and elevates your friend straight into the founding tier:</p>
        ${codeListHTML(codes)}
        <p>When you've shared all ten, you can mint another batch from your Postoffice (up to 100 total).</p>
      `),
    }),
    zh: ({ name, seat, codes }) => ({
      subject: `${seat} — 欢迎回家，创始会员`,
      html: shellHTML(`
        <p>欢迎回家，<strong>${name}</strong>。</p>
        <p>您的创始座位号是 <strong>${seat}</strong>。火漆已暖，门为您而开。</p>
        <p>十枚以您之名铸造的邀请已就绪。每被激活一次，您前移 1 位，受邀者直接进入创始会员等级：</p>
        ${codeListHTML(codes)}
        <p>当十枚分尽，您可在邮政室申请更多（终身上限 100 枚）。</p>
      `),
    }),
  },

  code_used: {
    en: ({ name, code, newSeat, byName }) => ({
      subject: 'Your code was used — you moved up',
      html: shellHTML(`
        <p>Owl post for <strong>${name}</strong>:</p>
        <p>Your code <strong style="font-family:monospace;">${code}</strong> was just used${byName ? ' by ' + byName : ''}. You're now <strong>${newSeat}</strong>.</p>
        <p>Keep sharing. Each dispatch is a small win.</p>
      `),
    }),
    zh: ({ name, code, newSeat, byName }) => ({
      subject: '您的邀请已被使用 — 您前移了',
      html: shellHTML(`
        <p>致 <strong>${name}</strong> 的猫头鹰来信：</p>
        <p>您的邀请码 <strong style="font-family:monospace;">${code}</strong> 刚被${byName ? ' ' + byName + ' ' : ''}使用。您现在是 <strong>${newSeat}</strong>。</p>
        <p>继续分享 — 每一封信都是一次小小的胜利。</p>
      `),
    }),
  },

  email_verify: {
    en: ({ name, verifyUrl }) => ({
      subject: 'Verify your email at Owlpo',
      html: shellHTML(`
        <p>Hello, <strong>${name}</strong>.</p>
        <p>Please confirm this is your email by clicking the link below. The link expires in 24 hours.</p>
        <p style="text-align:center;margin:24px 0;"><a href="${verifyUrl}" style="display:inline-block;padding:10px 22px;background:#1c1812;color:#f6f0e6;text-decoration:none;border-radius:8px;">Verify my email</a></p>
        <p style="font-size:13px;color:#6b6058;">If the button doesn't work, copy this link: <br><span style="word-break:break-all;">${verifyUrl}</span></p>
      `),
    }),
    zh: ({ name, verifyUrl }) => ({
      subject: '验证您在 Owlpo 的邮箱',
      html: shellHTML(`
        <p>您好，<strong>${name}</strong>。</p>
        <p>请点击下方链接验证您的邮箱。链接 24 小时内有效。</p>
        <p style="text-align:center;margin:24px 0;"><a href="${verifyUrl}" style="display:inline-block;padding:10px 22px;background:#1c1812;color:#f6f0e6;text-decoration:none;border-radius:8px;">验证邮箱</a></p>
        <p style="font-size:13px;color:#6b6058;">如按钮无效，请复制此链接：<br><span style="word-break:break-all;">${verifyUrl}</span></p>
      `),
    }),
  },

  password_reset: {
    en: ({ name, resetUrl }) => ({
      subject: 'Reset your Owlpo password',
      html: shellHTML(`
        <p>Hello, <strong>${name}</strong>.</p>
        <p>Click the link below to set a new password. It expires in 1 hour. If you didn't ask for this, you can safely ignore this email.</p>
        <p style="text-align:center;margin:24px 0;"><a href="${resetUrl}" style="display:inline-block;padding:10px 22px;background:#8b3a2e;color:#f6f0e6;text-decoration:none;border-radius:8px;">Set a new password</a></p>
        <p style="font-size:13px;color:#6b6058;">If the button doesn't work, copy this link: <br><span style="word-break:break-all;">${resetUrl}</span></p>
      `),
    }),
    zh: ({ name, resetUrl }) => ({
      subject: '重置您的 Owlpo 密码',
      html: shellHTML(`
        <p>您好，<strong>${name}</strong>。</p>
        <p>请点击下方链接设置新密码。链接 1 小时内有效。如非本人操作，可忽略此邮件。</p>
        <p style="text-align:center;margin:24px 0;"><a href="${resetUrl}" style="display:inline-block;padding:10px 22px;background:#8b3a2e;color:#f6f0e6;text-decoration:none;border-radius:8px;">设置新密码</a></p>
        <p style="font-size:13px;color:#6b6058;">如按钮无效，请复制此链接：<br><span style="word-break:break-all;">${resetUrl}</span></p>
      `),
    }),
  },

  codes_minted: {
    en: ({ name, codes }) => ({
      subject: '10 fresh dispatches are ready',
      html: shellHTML(`
        <p>Hello, <strong>${name}</strong>.</p>
        <p>Ten more invitations have been minted in your name:</p>
        ${codeListHTML(codes)}
        <p>Use them well, owl.</p>
      `),
    }),
    zh: ({ name, codes }) => ({
      subject: '10 枚新邀请已铸造',
      html: shellHTML(`
        <p>您好，<strong>${name}</strong>。</p>
        <p>以您之名铸造的十枚新邀请已就绪：</p>
        ${codeListHTML(codes)}
        <p>善用之，猫头鹰。</p>
      `),
    }),
  },
}

/* ─── Send + log ──────────────────────────────────────────────────────────── */

async function logEmail(baseUrl, key, row) {
  try {
    const res = await fetch(`${baseUrl}/rest/v1/email_log`, {
      method: 'POST',
      headers: { ...authHeaders(key), Prefer: 'return=representation' },
      body: JSON.stringify(row),
    })
    if (!res.ok) return null
    const j = await res.json()
    return Array.isArray(j) ? j[0] : j
  } catch {
    return null
  }
}

async function updateEmailLog(baseUrl, key, id, patch) {
  try {
    await fetch(`${baseUrl}/rest/v1/email_log?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...authHeaders(key), Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    })
  } catch {}
}

/**
 * Send a transactional email.
 *
 * @param {object} opts
 * @param {string} opts.baseUrl  - normalized Supabase URL
 * @param {string} opts.key      - service-role key
 * @param {string} opts.to       - recipient email
 * @param {string} opts.kind     - template name (key of T)
 * @param {string} [opts.language='en']
 * @param {object} opts.vars     - template variables
 * @param {string} [opts.userId]
 */
async function sendEmail({ baseUrl, key, to, kind, language = 'en', vars = {}, userId = null }) {
  const lang = language === 'zh' ? 'zh' : 'en'
  const tmpl = T[kind] && T[kind][lang]
  if (!tmpl) {
    console.error('sendEmail: unknown template', kind, lang)
    return { ok: false, error: 'unknown_template' }
  }
  const rendered = tmpl(vars)

  // Insert as pending so we have a record even on Resend timeout.
  const logRow = await logEmail(baseUrl, key, {
    to_email: to,
    user_id: userId,
    kind,
    language: lang,
    subject: rendered.subject,
    status: 'pending',
    attempt_count: 1,
  })

  const resendKey = RESEND_KEY()
  if (!resendKey) {
    if (logRow) {
      await updateEmailLog(baseUrl, key, logRow.id, {
        status: 'failed',
        error: 'RESEND_API_KEY missing',
      })
    }
    console.warn('sendEmail: RESEND_API_KEY not set, email skipped', kind, to)
    return { ok: false, error: 'no_resend_key' }
  }

  try {
    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM(),
        to: [to],
        subject: rendered.subject,
        html: rendered.html,
      }),
    })
    const text = await sendRes.text()
    if (!sendRes.ok) {
      if (logRow) {
        await updateEmailLog(baseUrl, key, logRow.id, {
          status: 'failed',
          error: text.slice(0, 500),
        })
      }
      console.error('Resend send failed', sendRes.status, text)
      return { ok: false, error: 'send_failed' }
    }
    let providerId = null
    try {
      providerId = JSON.parse(text).id || null
    } catch {}
    if (logRow) {
      await updateEmailLog(baseUrl, key, logRow.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        provider_message_id: providerId,
      })
    }
    return { ok: true, providerId }
  } catch (err) {
    if (logRow) {
      await updateEmailLog(baseUrl, key, logRow.id, {
        status: 'failed',
        error: String(err).slice(0, 500),
      })
    }
    console.error('Resend send threw', err)
    return { ok: false, error: 'send_threw' }
  }
}

module.exports = {
  sendEmail,
  formatSeat,
  templates: T,
}
