import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { warehouse, items, pluga, expected_return_date, notes } = body;

    if (!warehouse || !items || !items.length || !pluga) {
      return Response.json({ error: 'חסרים פרטים (מחסן, פריטים, פלוגה)' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Create pending withdrawal request (awaiting approval)
    const withdrawal = await base44.entities.WithdrawalRequest.create({
      warehouse,
      items: items.map((i) => ({ name: i.name, quantity: i.quantity, returnable: i.returnable })),
      requested_by_name: user.full_name || user.email,
      pluga,
      request_date: today,
      expected_return_date: expected_return_date || undefined,
      notes: notes || undefined,
      status: 'pending',
    });

    // Send email notification to all subscribers
    const settings = await base44.entities.EquipmentSettings.list();
    const emails = settings[0]?.notification_emails || [];
    if (emails.length > 0) {
      const itemsList = items.map((i) =>
        `<li>${i.name} - כמות: ${i.quantity}${i.returnable ? ' (להחזרה)' : ''}</li>`
      ).join('');
      const html = `
        <div dir="rtl" style="font-family: sans-serif; line-height: 1.6;">
          <h2>בקשת משיכת ציוד חדשה - ממתינה לאישור</h2>
          <p><strong>מבקש:</strong> ${user.full_name || user.email}</p>
          <p><strong>פלוגה:</strong> ${pluga}</p>
          <p><strong>מחסן:</strong> ${warehouse}</p>
          <p><strong>תאריך:</strong> ${today}</p>
          ${expected_return_date ? `<p><strong>תאריך החזרה צפוי:</strong> ${expected_return_date}</p>` : ''}
          <h3>פריטים מבוקשים:</h3>
          <ul>${itemsList}</ul>
          ${notes ? `<p><strong>הערות:</strong> ${notes}</p>` : ''}
          <p>יש לאשר את הבקשה במערכת משיכות הציוד.</p>
        </div>
      `;
      for (const email of emails) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: `בקשת משיכת ציוד ממתינה - ${pluga}`,
            html,
          });
        } catch (e) {
          // Email failure shouldn't block the withdrawal
        }
      }
    }

    return Response.json({ success: true, withdrawal });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}