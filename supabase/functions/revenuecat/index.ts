// Supabase Edge Function: receives RevenueCat webhooks and updates matchwerk+ status.
// RevenueCat → Project settings → Integrations → Webhooks:
//   URL:    https://<project>.supabase.co/functions/v1/revenuecat
//   Header: Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
// The app identifies users with Purchases.logIn(<supabase user id>), so app_user_id is the profile id.
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('REVENUECAT_WEBHOOK_SECRET')}`) {
    return new Response('forbidden', { status: 403 });
  }
  const { event } = await req.json();
  if (!event?.id) return new Response('ignored');

  // TRANSFER events move purchases between ids; the new owner is in transferred_to
  const userId: string | undefined = event.type === 'TRANSFER' ? event.transferred_to?.[0] : event.app_user_id;
  if (!userId || !UUID.test(userId)) return new Response('ignored (anonymous user)');

  const price = typeof event.price === 'number' ? event.price : null; // RevenueCat reports USD
  const { error } = await sb.rpc('billing_apply', {
    event_id: event.id,
    uid: userId,
    kind: event.type,
    product: event.product_id ?? null,
    store_name: event.store ?? null,
    price,
    expires: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
  });
  if (error) {
    console.error(error);
    return new Response(error.message, { status: 500 }); // RevenueCat retries
  }
  return new Response('ok');
});
