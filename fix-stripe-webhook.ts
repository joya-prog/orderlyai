#!/usr/bin/env node
/**
 * Fix Stripe Webhook URL - Direct API approach
 */

import { getUncachableStripeClient } from './server/stripeClient';

async function fixWebhook() {
  console.log('🔧 Fixing Stripe webhook URL...\n');

  try {
    const stripe = await getUncachableStripeClient();

    // Get current Replit domain
    const currentDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
    if (!currentDomain) {
      console.error('❌ REPLIT_DOMAINS not set');
      process.exit(1);
    }

    const webhookUrl = `https://${currentDomain}/api/stripe/webhook`;
    console.log(`📍 Current domain: ${currentDomain}`);
    console.log(`🔗 Webhook URL: ${webhookUrl}\n`);

    // List existing webhooks
    const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
    console.log(`📋 Found ${webhooks.data.length} webhook(s)\n`);

    let foundOrderlyWebhook = false;

    for (const webhook of webhooks.data) {
      console.log(`📝 Webhook: ${webhook.id}`);
      console.log(`   URL: ${webhook.url}`);
      console.log(`   Status: ${webhook.enabled ? 'Enabled' : 'Disabled'}`);
      
      // Check if this is an Orderly AI webhook that needs updating
      if (webhook.url.includes('orderly-ai-studio') || 
          webhook.url.includes('replit.app/api/stripe/webhook')) {
        foundOrderlyWebhook = true;
        
        if (webhook.url.includes(currentDomain)) {
          console.log(`   ✅ Already using correct domain`);
          if (!webhook.enabled) {
            await stripe.webhookEndpoints.update(webhook.id, { enabled: true });
            console.log(`   🟢 Re-enabled webhook`);
          }
        } else {
          console.log(`   ⚠️  Outdated URL, updating...`);
          try {
            // Extract UUID from old URL if present
            const oldUrlParts = webhook.url.split('/');
            const uuid = oldUrlParts[oldUrlParts.length - 1];
            const newUrl = `${webhookUrl}/${uuid}`;
            
            await stripe.webhookEndpoints.update(webhook.id, {
              url: newUrl,
              enabled: true,
            });
            console.log(`   ✅ Updated to: ${newUrl}`);
          } catch (err: any) {
            console.error(`   ❌ Failed to update: ${err.message}`);
            console.log(`   🗑️  Deleting and will recreate...`);
            await stripe.webhookEndpoints.del(webhook.id);
            console.log(`   ✅ Deleted old webhook`);
          }
        }
      }
      console.log('');
    }

    if (!foundOrderlyWebhook) {
      console.log('⚠️  No existing Orderly AI webhooks found');
      console.log('   The app will create one automatically on next startup\n');
    }

    console.log('🎉 Done!');
    console.log(`   Current webhook URL: ${webhookUrl}/[UUID]`);
    console.log('\n⚠️  IMPORTANT: You need to re-enable the webhook in Stripe Dashboard:');
    console.log('   https://dashboard.stripe.com/webhooks');
    console.log('   Find the webhook and click "Enable" if it was disabled.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixWebhook();
