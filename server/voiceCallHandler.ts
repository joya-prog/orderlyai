import { WebSocket, WebSocketServer } from 'ws';
import { Readable } from 'stream';
import { storage } from './storage';
import { generateAgentResponse, transcribeAudio, synthesizeSpeech, VoiceConfig, buildFlowContext } from './openai';
import { synthesizeElevenLabsSpeech } from './elevenlabs';
import { Agent } from '@shared/schema';

const MULAW_RATE = 8000;
const CHUNK_SIZE = 320;

interface CallerContext {
  isRepeatCustomer: boolean;
  customerName: string | null;
  contactId: string | null;
  lastOrders: Array<{
    items: string;
    total: string;
    date: string;
  }>;
}

interface CallSession {
  callSid: string;
  streamSid: string;
  agent: Agent;
  userId: string;
  phoneNumberId: string | null;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  audioBuffer: Buffer[];
  isProcessing: boolean;
  isSpeaking: boolean;
  isInterrupted: boolean;
  currentResponseAbortController: AbortController | null;
  silenceStart: number | null;
  lastActivityTime: number;
  ws: WebSocket;
  callStartTime: number;
  fromNumber: string;
  toNumber: string;
  knowledgeContext: string;
  squareMenuContext: string;
  flowContext: string;
  callerContext: CallerContext | null;
}

const activeCalls = new Map<string, CallSession>();

interface ConversationAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  outcome: 'order_placed' | 'reservation_made' | 'info_provided' | 'transferred' | 'callback_scheduled' | 'no_resolution';
}

function analyzeConversation(history: Array<{ role: 'user' | 'assistant'; content: string }>): ConversationAnalysis {
  const fullText = history.map(m => m.content.toLowerCase()).join(' ');
  
  // Detect outcome based on keywords
  let outcome: ConversationAnalysis['outcome'] = 'no_resolution';
  
  if (/order (placed|confirmed|complete|ready)|your order|total (is|comes to)|added to (your )?order/i.test(fullText)) {
    outcome = 'order_placed';
  } else if (/reservation (made|confirmed|booked)|table (for|reserved)|booked for/i.test(fullText)) {
    outcome = 'reservation_made';
  } else if (/transfer|connect you|hold please|connecting/i.test(fullText)) {
    outcome = 'transferred';
  } else if (/call (you )?back|callback|reach you later/i.test(fullText)) {
    outcome = 'callback_scheduled';
  } else if (history.length >= 4) {
    // If there was meaningful back-and-forth, likely info was provided
    outcome = 'info_provided';
  }
  
  // Detect sentiment based on user messages
  const userMessages = history.filter(m => m.role === 'user').map(m => m.content.toLowerCase()).join(' ');
  
  const positiveWords = ['thank', 'thanks', 'great', 'perfect', 'wonderful', 'excellent', 'awesome', 'appreciate', 'love', 'helpful', 'amazing', 'fantastic'];
  const negativeWords = ['angry', 'upset', 'frustrated', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'disgusting', 'unacceptable', 'ridiculous', 'never again'];
  
  const positiveCount = positiveWords.filter(w => userMessages.includes(w)).length;
  const negativeCount = negativeWords.filter(w => userMessages.includes(w)).length;
  
  let sentiment: ConversationAnalysis['sentiment'] = 'neutral';
  if (positiveCount > negativeCount && positiveCount >= 1) {
    sentiment = 'positive';
  } else if (negativeCount > positiveCount && negativeCount >= 1) {
    sentiment = 'negative';
  }
  
  return { sentiment, outcome };
}

export function mulawToLinear16(mulawBuffer: Buffer): Buffer {
  const linearBuffer = Buffer.alloc(mulawBuffer.length * 2);
  const MULAW_DECODE_TABLE = [
    -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
    -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
    -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
    -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316,
    -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
    -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
    -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
    -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
    -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
    -1372, -1308, -1244, -1180, -1116, -1052, -988, -924,
    -876, -844, -812, -780, -748, -716, -684, -652,
    -620, -588, -556, -524, -492, -460, -428, -396,
    -372, -356, -340, -324, -308, -292, -276, -260,
    -244, -228, -212, -196, -180, -164, -148, -132,
    -120, -112, -104, -96, -88, -80, -72, -64,
    -56, -48, -40, -32, -24, -16, -8, 0,
    32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
    23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
    15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
    11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316,
    7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140,
    5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092,
    3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004,
    2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980,
    1884, 1820, 1756, 1692, 1628, 1564, 1500, 1436,
    1372, 1308, 1244, 1180, 1116, 1052, 988, 924,
    876, 844, 812, 780, 748, 716, 684, 652,
    620, 588, 556, 524, 492, 460, 428, 396,
    372, 356, 340, 324, 308, 292, 276, 260,
    244, 228, 212, 196, 180, 164, 148, 132,
    120, 112, 104, 96, 88, 80, 72, 64,
    56, 48, 40, 32, 24, 16, 8, 0
  ];
  
  for (let i = 0; i < mulawBuffer.length; i++) {
    const sample = MULAW_DECODE_TABLE[mulawBuffer[i]];
    linearBuffer.writeInt16LE(sample, i * 2);
  }
  
  return linearBuffer;
}

export function linear16ToMulaw(linearBuffer: Buffer): Buffer {
  const mulawBuffer = Buffer.alloc(linearBuffer.length / 2);
  
  for (let i = 0; i < linearBuffer.length / 2; i++) {
    const sample = linearBuffer.readInt16LE(i * 2);
    const sign = (sample >> 8) & 0x80;
    let magnitude = Math.abs(sample);
    
    magnitude = Math.min(magnitude, 32635);
    magnitude += 0x84;
    
    let exponent = 7;
    let mask = 0x4000;
    while (!(magnitude & mask) && exponent > 0) {
      exponent--;
      mask >>= 1;
    }
    
    const mantissa = (magnitude >> (exponent + 3)) & 0x0F;
    const mulaw = ~(sign | (exponent << 4) | mantissa) & 0xFF;
    
    mulawBuffer[i] = mulaw;
  }
  
  return mulawBuffer;
}

async function resampleTo16kHz(buffer: Buffer, fromRate: number = 8000): Promise<Buffer> {
  const ratio = 16000 / fromRate;
  const outputLength = Math.floor(buffer.length / 2 * ratio);
  const output = Buffer.alloc(outputLength * 2);
  
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = Math.floor(i / ratio);
    const srcOffset = srcIndex * 2;
    if (srcOffset + 1 < buffer.length) {
      const sample = buffer.readInt16LE(srcOffset);
      output.writeInt16LE(sample, i * 2);
    }
  }
  
  return output;
}

async function resampleTo8kHz(buffer: Buffer): Promise<Buffer> {
  const ratio = 8000 / 16000;
  const inputSamples = buffer.length / 2;
  const outputSamples = Math.floor(inputSamples * ratio);
  const output = Buffer.alloc(outputSamples * 2);
  
  for (let i = 0; i < outputSamples; i++) {
    const srcIndex = Math.floor(i / ratio);
    const srcOffset = Math.min(srcIndex * 2, buffer.length - 2);
    const sample = buffer.readInt16LE(srcOffset);
    output.writeInt16LE(sample, i * 2);
  }
  
  return output;
}

async function mp3ToLinear16(mp3Buffer: Buffer): Promise<Buffer> {
  return mp3Buffer;
}

async function processAudioAndRespond(session: CallSession): Promise<void> {
  if (session.isProcessing || session.audioBuffer.length === 0) {
    return;
  }
  
  session.isProcessing = true;
  
  try {
    const mulawData = Buffer.concat(session.audioBuffer);
    session.audioBuffer = [];
    
    if (mulawData.length < 1600) {
      session.isProcessing = false;
      return;
    }
    
    const linearData = mulawToLinear16(mulawData);
    const upsampled = await resampleTo16kHz(linearData, MULAW_RATE);
    const wavBuffer = createWavBuffer(upsampled, 16000, 1, 16);
    
    console.log(`[Call ${session.callSid}] Transcribing ${wavBuffer.length} bytes of audio...`);
    
    const transcript = await transcribeAudio(wavBuffer);
    
    if (!transcript || transcript.trim().length === 0) {
      session.isProcessing = false;
      return;
    }
    
    console.log(`[Call ${session.callSid}] User said: "${transcript}"`);
    
    // Build full knowledge context including caller recognition
    let fullKnowledgeContext = session.knowledgeContext + session.squareMenuContext;
    if (session.callerContext) {
      fullKnowledgeContext += buildCallerContextPrompt(session.callerContext);
    }
    
    const response = await generateAgentResponse(
      session.agent.systemPrompt,
      session.agent.greetingMessage,
      session.agent.personality,
      fullKnowledgeContext,
      session.conversationHistory,
      transcript,
      session.flowContext
    );
    
    console.log(`[Call ${session.callSid}] Agent response: "${response}"`);
    
    session.conversationHistory.push(
      { role: 'user', content: transcript },
      { role: 'assistant', content: response }
    );
    
    await streamResponseToCall(session, response);
    
  } catch (error) {
    console.error(`[Call ${session.callSid}] Error processing audio:`, error);
  } finally {
    session.isProcessing = false;
  }
}

function createWavBuffer(audioData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const dataSize = audioData.length;
  const fileSize = 44 + dataSize;
  const header = Buffer.alloc(44);
  
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize - 8, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
  header.writeUInt16LE(channels * bitsPerSample / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  
  return Buffer.concat([header, audioData]);
}

async function streamResponseToCall(session: CallSession, text: string): Promise<void> {
  const abortController = new AbortController();
  session.currentResponseAbortController = abortController;
  session.isSpeaking = true;
  session.isInterrupted = false;
  
  try {
    const voiceConfig: VoiceConfig = {
      provider: session.agent.voiceProvider || 'openai',
      voiceId: session.agent.voiceId || 'nova',
      speed: session.agent.voiceSpeed || '1.0',
      volume: session.agent.voiceVolume || '100',
    };
    
    let audioBuffer: Buffer;
    
    if (voiceConfig.provider === 'elevenlabs') {
      const stability = parseFloat(session.agent.stability || '50') / 100;
      const similarity = parseFloat(session.agent.similarity || '75') / 100;
      const style = parseFloat(session.agent.styleExaggeration || '0') / 100;
      
      const stream = await synthesizeElevenLabsSpeech(voiceConfig.voiceId, text, {
        stability,
        similarityBoost: similarity,
        style,
        speakerBoost: session.agent.speakerBoost || false,
      });
      
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          console.log(`[Call ${session.callSid}] TTS generation interrupted`);
          break;
        }
        chunks.push(chunk);
      }
      audioBuffer = Buffer.concat(chunks);
    } else {
      audioBuffer = await synthesizeSpeech(text, voiceConfig);
    }
    
    if (abortController.signal.aborted) {
      console.log(`[Call ${session.callSid}] Response playback aborted before streaming`);
      return;
    }
    
    const chunkSize = 640;
    
    for (let i = 0; i < audioBuffer.length; i += chunkSize) {
      if (session.ws.readyState !== WebSocket.OPEN || abortController.signal.aborted) {
        if (abortController.signal.aborted) {
          console.log(`[Call ${session.callSid}] Response interrupted by caller`);
          sendClearMessage(session);
        }
        break;
      }
      
      const chunk = audioBuffer.slice(i, Math.min(i + chunkSize, audioBuffer.length));
      const base64Audio = chunk.toString('base64');
      
      const message = {
        event: 'media',
        streamSid: session.streamSid,
        media: {
          payload: base64Audio,
        },
      };
      
      session.ws.send(JSON.stringify(message));
      
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    
    if (!abortController.signal.aborted) {
      const markMessage = {
        event: 'mark',
        streamSid: session.streamSid,
        mark: {
          name: 'response_complete',
        },
      };
      session.ws.send(JSON.stringify(markMessage));
    }
    
  } catch (error) {
    console.error(`[Call ${session.callSid}] Error streaming response:`, error);
  } finally {
    session.isSpeaking = false;
    session.currentResponseAbortController = null;
  }
}

function sendClearMessage(session: CallSession): void {
  try {
    const clearMessage = {
      event: 'clear',
      streamSid: session.streamSid,
    };
    session.ws.send(JSON.stringify(clearMessage));
    console.log(`[Call ${session.callSid}] Sent clear message to stop audio playback`);
  } catch (error) {
    console.error(`[Call ${session.callSid}] Error sending clear message:`, error);
  }
}

function handleInterrupt(session: CallSession): void {
  if (session.isSpeaking && session.currentResponseAbortController) {
    const interruptionSensitivity = parseInt(session.agent.interruptionSensitivity || '5', 10);
    
    if (interruptionSensitivity >= 5 || session.audioBuffer.length > 3) {
      console.log(`[Call ${session.callSid}] Interrupting response (sensitivity: ${interruptionSensitivity})`);
      session.isInterrupted = true;
      session.currentResponseAbortController.abort();
      sendClearMessage(session);
    }
  }
}

async function getSquareMenuContext(userId: string): Promise<string> {
  try {
    const integration = await storage.getIntegrationByService('square', userId);
    if (!integration || integration.status !== 'active') {
      return '';
    }
    
    const credentials = integration.credentials as any;
    if (!credentials?.access_token) {
      return '';
    }
    
    const response = await fetch('https://connect.squareup.com/v2/catalog/list?types=ITEM,CATEGORY', {
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return '';
    }
    
    const data = await response.json();
    const items = (data.objects || []).filter((obj: any) => obj.type === 'ITEM');
    
    if (items.length === 0) {
      return '';
    }
    
    const menuList = items.slice(0, 30).map((item: any) => {
      const name = item.item_data?.name || 'Unknown';
      const variations = item.item_data?.variations || [];
      let price = '';
      if (variations[0]?.item_variation_data?.price_money) {
        price = ` - $${(variations[0].item_variation_data.price_money.amount / 100).toFixed(2)}`;
      }
      return `- ${name}${price}`;
    }).join('\n');
    
    return `\n\nLIVE MENU:\n${menuList}`;
  } catch (error) {
    console.error('Error fetching Square menu for call:', error);
    return '';
  }
}

async function getCallerContext(fromNumber: string, userId: string, agent: Agent): Promise<CallerContext | null> {
  // Check if repeat customer recognition is enabled for this agent
  if (!agent.repeatCustomerRecognition) {
    return null;
  }

  try {
    // Look up contact by phone number
    const contact = await storage.getContactByPhone(fromNumber, userId);
    
    if (!contact) {
      return null;
    }

    // Get their recent orders
    const recentOrders = await storage.getOrdersForContact(contact.id, 3);
    
    if (recentOrders.length === 0) {
      // Contact exists but no orders - still recognize them by name
      return {
        isRepeatCustomer: true,
        customerName: contact.name,
        contactId: contact.id,
        lastOrders: []
      };
    }

    // Format orders for AI context
    const lastOrders = recentOrders.map(order => {
      const items = order.items as Array<{ name: string; quantity: number }>;
      const itemSummary = items.map(i => `${i.quantity}x ${i.name}`).join(', ');
      const orderDate = order.createdAt 
        ? new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Recent';
      
      return {
        items: itemSummary,
        total: order.total,
        date: orderDate
      };
    });

    console.log(`[Voice] Recognized repeat customer: ${contact.name} with ${recentOrders.length} previous orders`);

    return {
      isRepeatCustomer: true,
      customerName: contact.name,
      contactId: contact.id,
      lastOrders
    };
  } catch (error) {
    console.error('Error getting caller context:', error);
    return null;
  }
}

function buildCallerContextPrompt(callerContext: CallerContext): string {
  if (!callerContext.isRepeatCustomer) {
    return '';
  }

  let prompt = `\n\nREPEAT CUSTOMER RECOGNITION:`;
  prompt += `\nThis caller is a returning customer named "${callerContext.customerName}".`;
  
  if (callerContext.lastOrders.length > 0) {
    prompt += `\n\nTheir previous orders:`;
    callerContext.lastOrders.forEach((order, index) => {
      prompt += `\n${index + 1}. ${order.items} ($${order.total}) on ${order.date}`;
    });
    
    const mostRecent = callerContext.lastOrders[0];
    prompt += `\n\nIMPORTANT: Warmly greet them by name and offer to reorder their most recent order: "${mostRecent.items}" for $${mostRecent.total}.`;
    prompt += `\nExample: "Welcome back, ${callerContext.customerName}! Great to hear from you again. Would you like to order your usual - ${mostRecent.items}?"`;
  } else {
    prompt += `\nGreet them warmly by name: "Welcome back, ${callerContext.customerName}! How can I help you today?"`;
  }

  return prompt;
}

export async function handleTwilioWebSocket(ws: WebSocket, req: any): Promise<void> {
  console.log('[Voice] New WebSocket connection from Twilio');
  
  let session: CallSession | null = null;
  let silenceTimer: NodeJS.Timeout | null = null;
  
  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.event) {
        case 'connected':
          console.log('[Voice] Twilio connected, protocol:', message.protocol);
          break;
          
        case 'start':
          const { callSid, streamSid, customParameters } = message.start;
          const agentId = customParameters?.agentId;
          const phoneNumberId = customParameters?.phoneNumberId;
          const fromNumber = customParameters?.from || message.start.from;
          const toNumber = customParameters?.to || message.start.to;
          
          console.log(`[Voice] Call started: ${callSid}, Agent: ${agentId}`);
          
          if (!agentId) {
            console.error('[Voice] No agentId in call parameters');
            ws.close();
            return;
          }
          
          const agent = await storage.getAgent(agentId);
          if (!agent) {
            console.error('[Voice] Agent not found:', agentId);
            ws.close();
            return;
          }
          
          const knowledgeItems = await storage.getKnowledgeBase(agentId, agent.userId);
          const knowledgeContext = knowledgeItems
            .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
            .join('\n\n');
          
          const squareMenuContext = await getSquareMenuContext(agent.userId);
          
          // Get flow nodes and connections for workflow context
          const flowNodes = await storage.getFlowNodes(agentId);
          const flowConnections = await storage.getFlowConnections(agentId);
          const flowContext = buildFlowContext(flowNodes, flowConnections);
          
          // Get caller context for repeat customer recognition
          const callerContext = await getCallerContext(fromNumber, agent.userId, agent);
          
          session = {
            callSid,
            streamSid,
            agent,
            userId: agent.userId,
            phoneNumberId,
            conversationHistory: [],
            audioBuffer: [],
            isProcessing: false,
            isSpeaking: false,
            isInterrupted: false,
            currentResponseAbortController: null,
            silenceStart: null,
            lastActivityTime: Date.now(),
            ws,
            callStartTime: Date.now(),
            fromNumber,
            toNumber,
            knowledgeContext,
            squareMenuContext,
            flowContext,
            callerContext,
          };
          
          activeCalls.set(callSid, session);
          
          await storage.createAnalyticsEvent({
            userId: agent.userId,
            agentId,
            eventType: 'call_started',
            eventData: { callSid, fromNumber, toNumber },
            metadata: { provider: 'orderly' },
          });
          
          // Generate personalized greeting for repeat customers
          let greeting = agent.greetingMessage;
          if (callerContext && callerContext.isRepeatCustomer && callerContext.customerName) {
            if (callerContext.lastOrders.length > 0) {
              const lastOrder = callerContext.lastOrders[0];
              greeting = `Welcome back, ${callerContext.customerName}! Great to hear from you again. Would you like to order your usual - ${lastOrder.items}?`;
            } else {
              greeting = `Welcome back, ${callerContext.customerName}! It's great to hear from you. How can I help you today?`;
            }
            console.log(`[Voice] Using personalized greeting for repeat customer: ${callerContext.customerName}`);
          }
          
          setTimeout(async () => {
            if (session && session.ws.readyState === WebSocket.OPEN) {
              await streamResponseToCall(session, greeting);
            }
          }, 500);
          
          break;
          
        case 'media':
          if (!session) break;
          
          session.lastActivityTime = Date.now();
          
          const audioPayload = Buffer.from(message.media.payload, 'base64');
          session.audioBuffer.push(audioPayload);
          
          if (session.isSpeaking) {
            handleInterrupt(session);
          }
          
          if (silenceTimer) {
            clearTimeout(silenceTimer);
          }
          
          silenceTimer = setTimeout(() => {
            if (session && !session.isProcessing && !session.isSpeaking) {
              processAudioAndRespond(session);
            }
          }, 1000);
          
          break;
          
        case 'mark':
          console.log(`[Voice] Mark received: ${message.mark?.name}`);
          break;
          
        case 'stop':
          console.log(`[Voice] Call stopped: ${session?.callSid}`);
          
          if (session) {
            const callDuration = Math.floor((Date.now() - session.callStartTime) / 1000);
            const durationMinutes = (callDuration / 60).toFixed(2);
            
            // Analyze conversation for sentiment and outcome
            const analysis = analyzeConversation(session.conversationHistory);
            
            // Calculate cost: $0.29/minute
            const costCents = Math.ceil((callDuration / 60) * 29);
            
            await storage.createCallLog({
              userId: session.userId,
              agentId: session.agent.id,
              phoneNumberId: session.phoneNumberId,
              callSid: session.callSid,
              direction: 'inbound',
              fromNumber: session.fromNumber,
              toNumber: session.toNumber,
              durationSeconds: callDuration.toString(),
              durationMinutes,
              status: 'completed',
              transcript: session.conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n'),
              sentiment: analysis.sentiment,
              endReason: 'customer_hangup',
              callOutcome: analysis.outcome,
              costCents: costCents.toString(),
              metadata: { provider: 'orderly' },
            });
            
            await storage.createAnalyticsEvent({
              userId: session.userId,
              agentId: session.agent.id,
              eventType: 'call_ended',
              duration: callDuration.toString(),
              eventData: { callSid: session.callSid, durationSeconds: callDuration, sentiment: analysis.sentiment, outcome: analysis.outcome },
              metadata: { provider: 'orderly' },
            });
            
            activeCalls.delete(session.callSid);
          }
          break;
      }
    } catch (error) {
      console.error('[Voice] Error processing WebSocket message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('[Voice] WebSocket closed');
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }
    if (session) {
      activeCalls.delete(session.callSid);
    }
  });
  
  ws.on('error', (error) => {
    console.error('[Voice] WebSocket error:', error);
  });
}

export function getActiveCalls(): Map<string, CallSession> {
  return activeCalls;
}

export function generateTwiML(agentId: string, phoneNumberId: string | null, baseUrl: string): string {
  const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}/voice-stream">
      <Parameter name="agentId" value="${agentId}" />
      <Parameter name="phoneNumberId" value="${phoneNumberId || ''}" />
    </Stream>
  </Connect>
</Response>`;
}

interface BrowserTestSession {
  callSid: string;
  agent: Agent;
  userId: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  isProcessing: boolean;
  isSpeaking: boolean;
  ws: WebSocket;
  callStartTime: number;
  knowledgeContext: string;
  squareMenuContext: string;
  flowContext: string;
  audioBuffer: Buffer[];
  silenceTimer: NodeJS.Timeout | null;
  lastAudioTime: number;
}

const browserTestSessions = new Map<string, BrowserTestSession>();

// Default greeting for agents without custom greeting configured
const DEFAULT_GREETING = "Hello! Thank you for calling. How can I help you today?";

export async function handleBrowserTestWebSocket(ws: WebSocket, agentId: string, userId: string): Promise<void> {
  console.log(`[BrowserTest] New test call session for agent ${agentId}`);
  
  const agent = await storage.getAgent(agentId);
  if (!agent) {
    console.error('[BrowserTest] Agent not found:', agentId);
    ws.send(JSON.stringify({ type: 'error', message: 'Agent not found' }));
    ws.close();
    return;
  }
  
  if (agent.userId !== userId) {
    console.error('[BrowserTest] Agent does not belong to user');
    ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
    ws.close();
    return;
  }
  
  const knowledgeItems = await storage.getKnowledgeBase(agentId, userId);
  const knowledgeContext = knowledgeItems
    .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
    .join('\n\n');
  
  const squareMenuContext = await getSquareMenuContext(userId);
  
  // Get flow nodes and connections for workflow context
  const flowNodes = await storage.getFlowNodes(agentId);
  const flowConnections = await storage.getFlowConnections(agentId);
  const flowContext = buildFlowContext(flowNodes, flowConnections);
  
  const callSid = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  const session: BrowserTestSession = {
    callSid,
    agent,
    userId,
    conversationHistory: [],
    isProcessing: false,
    isSpeaking: false,
    ws,
    callStartTime: Date.now(),
    knowledgeContext,
    squareMenuContext,
    flowContext,
    audioBuffer: [],
    silenceTimer: null,
    lastAudioTime: 0,
  };
  
  browserTestSessions.set(callSid, session);
  
  ws.send(JSON.stringify({ 
    type: 'connected', 
    callSid,
    agentName: agent.name 
  }));
  
  // Send greeting immediately - no delay needed
  sendBrowserGreeting(session).catch(err => {
    console.error('[BrowserTest] Error sending greeting:', err);
  });
  
  const SILENCE_THRESHOLD_MS = 1500; // Process audio after 1.5 seconds of silence
  const MIN_AUDIO_LENGTH = 16000 * 2 * 0.5; // At least 0.5 seconds of 16kHz 16-bit audio
  
  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'audio_chunk':
          // Streaming audio chunks from browser microphone
          const chunkData = Buffer.from(message.audio, 'base64');
          session.audioBuffer.push(chunkData);
          session.lastAudioTime = Date.now();
          
          // If agent is speaking and we detect voice, this could trigger interrupt
          // For now, just buffer audio
          
          // Reset silence timer
          if (session.silenceTimer) {
            clearTimeout(session.silenceTimer);
          }
          
          // Set new silence timer to process audio after pause
          if (!session.isProcessing) {
            session.silenceTimer = setTimeout(async () => {
              const totalBuffer = Buffer.concat(session.audioBuffer);
              
              if (totalBuffer.length >= MIN_AUDIO_LENGTH) {
                console.log(`[BrowserTest ${callSid}] Processing ${totalBuffer.length} bytes of audio`);
                session.audioBuffer = [];
                await processBrowserAudio(session, totalBuffer);
              } else {
                console.log(`[BrowserTest ${callSid}] Audio too short, skipping (${totalBuffer.length} bytes)`);
                session.audioBuffer = [];
                // Stay in listening state
                if (session.ws.readyState === WebSocket.OPEN) {
                  session.ws.send(JSON.stringify({ type: 'state', state: 'listening' }));
                }
              }
            }, SILENCE_THRESHOLD_MS);
          }
          break;
          
        case 'audio':
          // Legacy: Complete audio blob (for compatibility)
          if (session.isProcessing) break;
          
          const audioData = Buffer.from(message.audio, 'base64');
          await processBrowserAudio(session, audioData);
          break;
          
        case 'text':
          if (session.isProcessing) break;
          await processBrowserText(session, message.text);
          break;
          
        case 'end':
          console.log(`[BrowserTest] Test call ended: ${callSid}`);
          if (session.silenceTimer) {
            clearTimeout(session.silenceTimer);
          }
          browserTestSessions.delete(callSid);
          ws.close();
          break;
      }
    } catch (error) {
      console.error('[BrowserTest] Error processing message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Processing error' }));
    }
  });
  
  ws.on('close', () => {
    console.log(`[BrowserTest] Session closed: ${callSid}`);
    if (session.silenceTimer) {
      clearTimeout(session.silenceTimer);
    }
    browserTestSessions.delete(callSid);
  });
  
  ws.on('error', (error) => {
    console.error('[BrowserTest] WebSocket error:', error);
  });
}

async function sendBrowserGreeting(session: BrowserTestSession): Promise<void> {
  try {
    session.ws.send(JSON.stringify({ 
      type: 'state', 
      state: 'speaking' 
    }));
    
    // Use default greeting if agent doesn't have one configured
    const greetingText = session.agent.greetingMessage?.trim() || DEFAULT_GREETING;
    
    const voiceConfig: VoiceConfig = {
      provider: session.agent.voiceProvider || 'openai',
      voiceId: session.agent.voiceId || 'nova',
      speed: session.agent.voiceSpeed || '1.0',
      volume: session.agent.voiceVolume || '100',
    };
    
    let audioBuffer: Buffer;
    
    if (voiceConfig.provider === 'elevenlabs') {
      const stability = parseFloat(session.agent.stability || '50') / 100;
      const similarity = parseFloat(session.agent.similarity || '75') / 100;
      const style = parseFloat(session.agent.styleExaggeration || '0') / 100;
      
      const stream = await synthesizeElevenLabsSpeech(voiceConfig.voiceId, greetingText, {
        stability,
        similarityBoost: similarity,
        style,
        speakerBoost: session.agent.speakerBoost || false,
      });
      
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      audioBuffer = Buffer.concat(chunks);
    } else {
      audioBuffer = await synthesizeSpeech(greetingText, voiceConfig);
    }
    
    console.log(`[BrowserTest ${session.callSid}] Generated greeting audio: ${audioBuffer.length} bytes`);
    
    session.ws.send(JSON.stringify({
      type: 'audio',
      audio: audioBuffer.toString('base64'),
      text: greetingText,
    }));
    
    console.log(`[BrowserTest ${session.callSid}] Greeting audio sent to client`);
    
    session.conversationHistory.push({
      role: 'assistant',
      content: greetingText,
    });
    
    session.ws.send(JSON.stringify({ 
      type: 'state', 
      state: 'listening' 
    }));
    
  } catch (error) {
    console.error('[BrowserTest] Error sending greeting:', error);
  }
}

async function processBrowserAudio(session: BrowserTestSession, audioData: Buffer): Promise<void> {
  session.isProcessing = true;
  
  try {
    session.ws.send(JSON.stringify({ 
      type: 'state', 
      state: 'processing' 
    }));
    
    const wavBuffer = createWavBuffer(audioData, 16000, 1, 16);
    const transcript = await transcribeAudio(wavBuffer);
    
    if (!transcript || transcript.trim().length === 0) {
      session.isProcessing = false;
      session.ws.send(JSON.stringify({ 
        type: 'state', 
        state: 'listening' 
      }));
      return;
    }
    
    console.log(`[BrowserTest ${session.callSid}] User said: "${transcript}"`);
    
    session.ws.send(JSON.stringify({
      type: 'transcript',
      text: transcript,
      role: 'user',
    }));
    
    await generateAndSendResponse(session, transcript);
    
  } catch (error) {
    console.error('[BrowserTest] Error processing audio:', error);
    session.ws.send(JSON.stringify({ type: 'error', message: 'Audio processing failed' }));
  } finally {
    session.isProcessing = false;
  }
}

async function processBrowserText(session: BrowserTestSession, text: string): Promise<void> {
  session.isProcessing = true;
  
  try {
    session.ws.send(JSON.stringify({ 
      type: 'state', 
      state: 'processing' 
    }));
    
    console.log(`[BrowserTest ${session.callSid}] User typed: "${text}"`);
    
    await generateAndSendResponse(session, text);
    
  } catch (error) {
    console.error('[BrowserTest] Error processing text:', error);
    session.ws.send(JSON.stringify({ type: 'error', message: 'Text processing failed' }));
  } finally {
    session.isProcessing = false;
  }
}

async function generateAndSendResponse(session: BrowserTestSession, userInput: string): Promise<void> {
  const fullKnowledgeContext = session.knowledgeContext + session.squareMenuContext;
  
  const response = await generateAgentResponse(
    session.agent.systemPrompt,
    session.agent.greetingMessage,
    session.agent.personality,
    fullKnowledgeContext,
    session.conversationHistory,
    userInput,
    session.flowContext
  );
  
  console.log(`[BrowserTest ${session.callSid}] Agent response: "${response}"`);
  
  session.conversationHistory.push(
    { role: 'user', content: userInput },
    { role: 'assistant', content: response }
  );
  
  session.ws.send(JSON.stringify({ 
    type: 'state', 
    state: 'speaking' 
  }));
  
  const voiceConfig: VoiceConfig = {
    provider: session.agent.voiceProvider || 'openai',
    voiceId: session.agent.voiceId || 'nova',
    speed: session.agent.voiceSpeed || '1.0',
    volume: session.agent.voiceVolume || '100',
  };
  
  let audioBuffer: Buffer;
  
  if (voiceConfig.provider === 'elevenlabs') {
    const stability = parseFloat(session.agent.stability || '50') / 100;
    const similarity = parseFloat(session.agent.similarity || '75') / 100;
    const style = parseFloat(session.agent.styleExaggeration || '0') / 100;
    
    const stream = await synthesizeElevenLabsSpeech(voiceConfig.voiceId, response, {
      stability,
      similarityBoost: similarity,
      style,
      speakerBoost: session.agent.speakerBoost || false,
    });
    
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    audioBuffer = Buffer.concat(chunks);
  } else {
    audioBuffer = await synthesizeSpeech(response, voiceConfig);
  }
  
  console.log(`[BrowserTest ${session.callSid}] Generated audio: ${audioBuffer.length} bytes`);
  
  session.ws.send(JSON.stringify({
    type: 'audio',
    audio: audioBuffer.toString('base64'),
    text: response,
  }));
  
  console.log(`[BrowserTest ${session.callSid}] Audio sent to client`);
  
  session.ws.send(JSON.stringify({ 
    type: 'state', 
    state: 'listening' 
  }));
}
