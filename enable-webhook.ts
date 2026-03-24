import { getUncachableStripeClient } from './server/stripeClient';

async function enableWebhook() {
  const stripe = await getUncachableStripeClient();
  const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
  
  for (const webhook of webhooks.data) {
    if (!webhook.enabled) {
      console.log('Enabling webhook:', webhook.id);
      await stripe.webhookEndpoints.update(webhook.id, { disabled: false });
      console.log('✅ Enabled');
    } else {
      console.log('Already enabled:', webhook.id);
    }
  }
}

enableWebhook();
