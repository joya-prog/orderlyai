import { db } from "../server/db";
import { analyticsEvents, users, agents } from "../shared/schema";
import { sql } from "drizzle-orm";

const RESTAURANT_NAMES = [
  "Bella Italia", "The Golden Fork", "Ocean's Table", "Mountain View Bistro"
];

const MENU_ITEMS = [
  { name: "Grilled Salmon", price: 28.99 },
  { name: "Filet Mignon", price: 45.99 },
  { name: "Caesar Salad", price: 14.99 },
  { name: "Lobster Risotto", price: 38.99 },
  { name: "Truffle Pasta", price: 32.99 },
  { name: "Margherita Pizza", price: 18.99 },
  { name: "Chicken Parmesan", price: 24.99 },
  { name: "Seafood Linguine", price: 29.99 },
  { name: "Vegetable Curry", price: 19.99 },
  { name: "Rack of Lamb", price: 42.99 },
];

const CALLER_NAMES = [
  "Michael Johnson", "Sarah Williams", "David Brown", "Emily Davis",
  "Robert Martinez", "Jennifer Garcia", "William Anderson", "Elizabeth Taylor",
  "James Wilson", "Amanda Moore", "Christopher Lee", "Stephanie White",
  "Daniel Harris", "Michelle Thompson", "Matthew Jackson", "Ashley Robinson"
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): Date {
  const now = new Date();
  const pastDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const randomTime = pastDate.getTime() + Math.random() * (now.getTime() - pastDate.getTime());
  return new Date(randomTime);
}

function getDateNDaysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randomInt(10, 21), randomInt(0, 59), randomInt(0, 59));
  return d;
}

async function seedAnalytics() {
  console.log("Seeding analytics data...");

  // Get the first user and first agent
  const existingUsers = await db.select().from(users).limit(1);
  const existingAgents = await db.select().from(agents).limit(1);

  if (existingUsers.length === 0) {
    console.log("No users found. Please create a user first.");
    return;
  }

  const userId = existingUsers[0].id;
  const agentId = existingAgents.length > 0 ? existingAgents[0].id : null;

  console.log(`Using userId: ${userId}, agentId: ${agentId}`);

  // Clear existing analytics events
  await db.delete(analyticsEvents);
  console.log("Cleared existing analytics events");

  const events: any[] = [];

  // Generate data for the last 30 days with realistic patterns
  for (let day = 30; day >= 0; day--) {
    // Weekends have fewer calls, weekdays are busier
    const date = getDateNDaysAgo(day);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Base call volume: 8-15 on weekdays, 5-10 on weekends
    const callCount = isWeekend ? randomInt(5, 10) : randomInt(8, 18);
    
    // Lunch rush (11-14) and dinner rush (17-21) have more calls
    for (let i = 0; i < callCount; i++) {
      const hour = Math.random() < 0.6 
        ? (Math.random() < 0.4 ? randomInt(11, 14) : randomInt(17, 21))
        : randomInt(10, 22);
      
      const callDate = new Date(date);
      callDate.setHours(hour, randomInt(0, 59), randomInt(0, 59));
      
      const callDuration = randomInt(45, 300); // 45 seconds to 5 minutes
      const callerName = randomChoice(CALLER_NAMES);
      
      // Call started event
      events.push({
        userId,
        agentId,
        eventType: "call_started",
        eventData: {
          callerName,
          callerPhone: `+1${randomInt(200, 999)}${randomInt(100, 999)}${randomInt(1000, 9999)}`,
        },
        duration: null,
        metadata: { source: "twilio" },
        createdAt: callDate,
      });
      
      // Call ended event
      const endDate = new Date(callDate.getTime() + callDuration * 1000);
      const outcomes = ["order_placed", "reservation_made", "info_provided", "transferred", "no_resolution"];
      const outcomeWeights = [0.35, 0.25, 0.25, 0.08, 0.07];
      const rand = Math.random();
      let cumulative = 0;
      let outcome = "info_provided";
      for (let j = 0; j < outcomes.length; j++) {
        cumulative += outcomeWeights[j];
        if (rand < cumulative) {
          outcome = outcomes[j];
          break;
        }
      }
      
      events.push({
        userId,
        agentId,
        eventType: "call_ended",
        eventData: {
          callerName,
          outcome,
          satisfaction: randomInt(3, 5),
        },
        duration: callDuration.toString(),
        metadata: { 
          source: "twilio",
          endReason: outcome === "transferred" ? "transfer" : "customer_hangup"
        },
        createdAt: endDate,
      });
      
      // If order was placed, add order event
      if (outcome === "order_placed") {
        const itemCount = randomInt(1, 4);
        const items = [];
        let orderTotal = 0;
        
        for (let k = 0; k < itemCount; k++) {
          const item = randomChoice(MENU_ITEMS);
          const quantity = randomInt(1, 3);
          items.push({ ...item, quantity });
          orderTotal += item.price * quantity;
        }
        
        // Add tip (15-25%)
        const tipPercent = randomInt(15, 25);
        const tip = orderTotal * (tipPercent / 100);
        orderTotal += tip;
        
        events.push({
          userId,
          agentId,
          eventType: "order_placed",
          eventData: {
            items,
            subtotal: (orderTotal - tip).toFixed(2),
            tip: tip.toFixed(2),
          },
          duration: null,
          metadata: {
            amount: parseFloat(orderTotal.toFixed(2)),
            itemCount,
            orderType: Math.random() < 0.6 ? "pickup" : "delivery",
          },
          createdAt: new Date(endDate.getTime() + 5000),
        });
      }
      
      // If reservation was made, add reservation event
      if (outcome === "reservation_made") {
        const partySize = randomInt(2, 8);
        const reservationDate = new Date(callDate);
        reservationDate.setDate(reservationDate.getDate() + randomInt(1, 14));
        const reservationHour = randomInt(17, 21);
        reservationDate.setHours(reservationHour, randomInt(0, 1) * 30, 0);
        
        events.push({
          userId,
          agentId,
          eventType: "reservation_made",
          eventData: {
            partySize,
            reservationDate: reservationDate.toISOString(),
            reservationTime: `${reservationHour}:${randomInt(0, 1) * 30 || "00"}`,
            specialRequests: Math.random() < 0.3 ? "Window table preferred" : null,
          },
          duration: null,
          metadata: {
            guestName: callerName,
            confirmationSent: true,
          },
          createdAt: new Date(endDate.getTime() + 3000),
        });
      }
      
      // Sometimes detect intents during calls
      if (Math.random() < 0.4) {
        const intents = ["menu_inquiry", "hours_inquiry", "location_inquiry", "special_request", "dietary_question"];
        events.push({
          userId,
          agentId,
          eventType: "intent_detected",
          eventData: {
            intent: randomChoice(intents),
            confidence: (0.85 + Math.random() * 0.15).toFixed(2),
          },
          duration: null,
          metadata: {},
          createdAt: new Date(callDate.getTime() + randomInt(10, 60) * 1000),
        });
      }
    }
  }

  // Sort events by createdAt
  events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Insert in batches
  const batchSize = 50;
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    await db.insert(analyticsEvents).values(batch);
    console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(events.length / batchSize)}`);
  }

  console.log(`\nSeeded ${events.length} analytics events!`);
  
  // Summary
  const callsStarted = events.filter(e => e.eventType === "call_started").length;
  const ordersPlaced = events.filter(e => e.eventType === "order_placed").length;
  const reservations = events.filter(e => e.eventType === "reservation_made").length;
  const totalRevenue = events
    .filter(e => e.eventType === "order_placed")
    .reduce((sum, e) => sum + (e.metadata?.amount || 0), 0);
  
  console.log(`\nSummary:`);
  console.log(`  Total Calls: ${callsStarted}`);
  console.log(`  Orders Placed: ${ordersPlaced}`);
  console.log(`  Reservations Made: ${reservations}`);
  console.log(`  Total Revenue: $${totalRevenue.toFixed(2)}`);
}

seedAnalytics()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error seeding analytics:", err);
    process.exit(1);
  });
