import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only admins or equipment managers can approve/reject
    if (user.role !== 'admin' && !user.equipment_manager) {
      return Response.json({ error: 'אין הרשאה לאשר בקשות' }, { status: 403 });
    }

    const body = await req.json();
    const { withdrawal_id, decision } = body;

    if (!withdrawal_id || !decision) {
      return Response.json({ error: 'חסרים פרטים' }, { status: 400 });
    }
    if (decision !== 'approved' && decision !== 'rejected') {
      return Response.json({ error: 'החלטה לא תקינה' }, { status: 400 });
    }

    const withdrawal = await base44.entities.WithdrawalRequest.get(withdrawal_id);
    if (!withdrawal) {
      return Response.json({ error: 'בקשה לא נמצאה' }, { status: 404 });
    }
    if (withdrawal.status !== 'pending') {
      return Response.json({ error: 'הבקשה כבר טופלה' }, { status: 400 });
    }

    const approverName = user.full_name || user.email;

    if (decision === 'rejected') {
      await base44.entities.WithdrawalRequest.update(withdrawal_id, {
        status: 'rejected',
        approved_by_name: approverName,
      });
      return Response.json({ success: true, status: 'rejected' });
    }

    // Approved — process the withdrawal
    const { warehouse, items, pluga, expected_return_date } = withdrawal;
    const today = new Date().toISOString().split('T')[0];

    // Validate inventory availability
    const warehouseItems = await base44.entities.WarehouseItem.filter({ warehouse });
    for (const item of items) {
      const wi = warehouseItems.find((w) => w.name === item.name);
      if (!wi) {
        return Response.json({ error: `פריט "${item.name}" לא נמצא במחסן` }, { status: 400 });
      }
      if (wi.quantity < item.quantity) {
        return Response.json({ error: `אין מספיק "${item.name}" במלאי (יש ${wi.quantity}, מבוקש ${item.quantity})` }, { status: 400 });
      }
    }

    // Decrement inventory
    for (const item of items) {
      const wi = warehouseItems.find((w) => w.name === item.name);
      await base44.entities.WarehouseItem.update(wi.id, { quantity: wi.quantity - item.quantity });
    }

    // Track returnable equipment
    const returnableItems = items.filter((i) => i.returnable);
    if (returnableItems.length > 0) {
      await base44.entities.EquipmentHolding.bulkCreate(
        returnableItems.map((i) => ({
          item_name: i.name,
          warehouse,
          quantity: i.quantity,
          pluga,
          held_by_name: withdrawal.requested_by_name,
          withdrawal_date: today,
          expected_return_date: expected_return_date || undefined,
        }))
      );
    }

    // Update withdrawal status
    await base44.entities.WithdrawalRequest.update(withdrawal_id, {
      status: 'approved',
      approved_by_name: approverName,
    });

    return Response.json({ success: true, status: 'approved' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}