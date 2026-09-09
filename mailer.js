import nodemailer from "nodemailer";

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function daysOverdue(nextReminder) {
  const ms = new Date().getTime() - new Date(nextReminder).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export async function sendReminderDigest(deals) {
  if (deals.length === 0) return { sent: false, reason: "no overdue deals" };

  const rows = deals
    .map(
      (d) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${d.title}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${d.customerEmail || ""}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">$${Number(d.price || 0).toLocaleString()}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${d.status}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${daysOverdue(d.nextReminder)} days</td>
        </tr>`
    )
    .join("");

  const html = `
    <h2>Deals overdue for follow-up (${deals.length})</h2>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;width:100%;">
      <thead>
        <tr style="text-align:left;background:#f2f2f2;">
          <th style="padding:6px 10px;">Title</th>
          <th style="padding:6px 10px;">Customer</th>
          <th style="padding:6px 10px;">Value</th>
          <th style="padding:6px 10px;">Status</th>
          <th style="padding:6px 10px;">Overdue by</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const info = await transporter().sendMail({
    from: process.env.DIGEST_FROM,
    to: process.env.DIGEST_TO,
    subject: `${deals.length} deal(s) overdue for follow-up`,
    html,
  });

  return { sent: true, messageId: info.messageId };
}
