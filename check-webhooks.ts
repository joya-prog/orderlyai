import { getUncachableStripeClient } from './server/stripeClient';

async function checkWebhooks() {
  const stripe = await getUncachableStripeClient();
  const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
  console.log('Active webhooks:');
  for (const wh of webhooks.data) {
    console.log(' ', wh.id, '-', wh.url, '-', wh.enabled ? 'ENABLED' : 'DISABLED');
  }
}

checkWebhooks();
