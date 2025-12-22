import Retell from 'retell-sdk';

const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.warn('[Retell] RETELL_API_KEY not configured - Retell integration disabled');
}

const retellClient = RETELL_API_KEY ? new Retell({ apiKey: RETELL_API_KEY }) : null;

export interface RetellAgentConfig {
  agentName: string;
  voiceId: string;
  voiceModel?: string;
  voiceSpeed?: number;
  voiceTemperature?: number;
  volume?: number;
  responsiveness?: number;
  interruptionSensitivity?: number;
  language?: string;
  enableBackchannel?: boolean;
  backchannelFrequency?: number;
  backchannelWords?: string[];
  reminderTriggerMs?: number;
  reminderMaxCount?: number;
  reminderMessage?: string;
  ambientSound?: string;
  ambientSoundVolume?: number;
  boostedKeywords?: string[];
  pronunciationDictionary?: Array<{ word: string; pronunciation: string }>;
  beginMessageDelayMs?: number;
  endCallPhrases?: string[];
  maxCallDurationMs?: number;
  inactivityTimeoutMs?: number;
  fallbackVoiceId?: string;
  voicemailDetection?: boolean;
  voicemailMessage?: string;
  warmTransferEnabled?: boolean;
  warmTransferNumber?: string;
  warmTransferMessage?: string;
  llmId?: string;
  webhookUrl?: string;
}

export interface RetellLLMConfig {
  generalPrompt: string;
  beginMessage?: string;
  generalTools?: Array<{
    type: string;
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  }>;
  inboundDynamicVariablesWebhookUrl?: string;
  model?: string;
  modelTemperature?: number;
  knowledgeBaseIds?: string[];
}

export interface RetellCallLog {
  callId: string;
  agentId: string;
  callType: string;
  callStatus: string;
  startTimestamp: number;
  endTimestamp?: number;
  transcript?: string;
  recordingUrl?: string;
  publicLogUrl?: string;
  disconnectionReason?: string;
  callAnalysis?: {
    callSuccessful?: boolean;
    callSummary?: string;
    userSentiment?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface RetellPhoneNumber {
  phoneNumber: string;
  phoneNumberPretty: string;
  inboundAgentId?: string;
  outboundAgentId?: string;
  areaCode?: string;
  nickname?: string;
  lastModificationTimestamp: number;
}

export async function isRetellConfigured(): Promise<boolean> {
  return retellClient !== null;
}

export async function createRetellLLM(config: RetellLLMConfig): Promise<string | null> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return null;
  }

  try {
    const llmResponse = await retellClient.llm.create({
      general_prompt: config.generalPrompt,
      begin_message: config.beginMessage,
      general_tools: config.generalTools as any,
      inbound_dynamic_variables_webhook_url: config.inboundDynamicVariablesWebhookUrl,
      model: config.model as any || 'gpt-4o-mini',
      model_temperature: config.modelTemperature,
    });

    console.log('[Retell] Created LLM:', llmResponse.llm_id);
    return llmResponse.llm_id;
  } catch (error) {
    console.error('[Retell] Error creating LLM:', error);
    throw error;
  }
}

export async function updateRetellLLM(llmId: string, config: Partial<RetellLLMConfig>): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    await retellClient.llm.update(llmId, {
      general_prompt: config.generalPrompt,
      begin_message: config.beginMessage,
      general_tools: config.generalTools as any,
      model: config.model as any,
      model_temperature: config.modelTemperature,
    });

    console.log('[Retell] Updated LLM:', llmId);
    return true;
  } catch (error) {
    console.error('[Retell] Error updating LLM:', error);
    throw error;
  }
}

export async function deleteRetellLLM(llmId: string): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    await retellClient.llm.delete(llmId);
    console.log('[Retell] Deleted LLM:', llmId);
    return true;
  } catch (error) {
    console.error('[Retell] Error deleting LLM:', error);
    return false;
  }
}

export async function createRetellAgent(config: RetellAgentConfig, llmId: string): Promise<string | null> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return null;
  }

  try {
    const agentResponse = await retellClient.agent.create({
      response_engine: {
        type: 'retell-llm',
        llm_id: llmId,
      },
      voice_id: config.voiceId,
      agent_name: config.agentName,
      voice_model: config.voiceModel as any,
      voice_speed: config.voiceSpeed,
      voice_temperature: config.voiceTemperature,
      volume: config.volume,
      responsiveness: config.responsiveness,
      interruption_sensitivity: config.interruptionSensitivity,
      language: config.language as any,
      enable_backchannel: config.enableBackchannel,
      backchannel_frequency: config.backchannelFrequency,
      backchannel_words: config.backchannelWords,
      reminder_trigger_ms: config.reminderTriggerMs,
      reminder_max_count: config.reminderMaxCount,
      ambient_sound: config.ambientSound as any,
      ambient_sound_volume: config.ambientSoundVolume,
      boosted_keywords: config.boostedKeywords,
      begin_message_delay_ms: config.beginMessageDelayMs,
      webhook_url: config.webhookUrl,
    });

    console.log('[Retell] Created agent:', agentResponse.agent_id);
    return agentResponse.agent_id;
  } catch (error) {
    console.error('[Retell] Error creating agent:', error);
    throw error;
  }
}

export async function updateRetellAgent(agentId: string, config: Partial<RetellAgentConfig>): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    await retellClient.agent.update(agentId, {
      agent_name: config.agentName,
      voice_id: config.voiceId,
      voice_model: config.voiceModel as any,
      voice_speed: config.voiceSpeed,
      voice_temperature: config.voiceTemperature,
      volume: config.volume,
      responsiveness: config.responsiveness,
      interruption_sensitivity: config.interruptionSensitivity,
      language: config.language as any,
      enable_backchannel: config.enableBackchannel,
      backchannel_frequency: config.backchannelFrequency,
      backchannel_words: config.backchannelWords,
      reminder_trigger_ms: config.reminderTriggerMs,
      reminder_max_count: config.reminderMaxCount,
      ambient_sound: config.ambientSound as any,
      ambient_sound_volume: config.ambientSoundVolume,
      boosted_keywords: config.boostedKeywords,
      begin_message_delay_ms: config.beginMessageDelayMs,
      webhook_url: config.webhookUrl,
    });

    console.log('[Retell] Updated agent:', agentId);
    return true;
  } catch (error) {
    console.error('[Retell] Error updating agent:', error);
    throw error;
  }
}

export async function deleteRetellAgent(agentId: string): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    await retellClient.agent.delete(agentId);
    console.log('[Retell] Deleted agent:', agentId);
    return true;
  } catch (error) {
    console.error('[Retell] Error deleting agent:', error);
    return false;
  }
}

export async function getRetellAgent(agentId: string): Promise<any | null> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return null;
  }

  try {
    const agent = await retellClient.agent.retrieve(agentId);
    return agent;
  } catch (error) {
    console.error('[Retell] Error getting agent:', error);
    return null;
  }
}

export async function listRetellAgents(): Promise<any[]> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return [];
  }

  try {
    const agents = await retellClient.agent.list();
    return agents;
  } catch (error) {
    console.error('[Retell] Error listing agents:', error);
    return [];
  }
}

export async function getRetellCallLogs(agentId?: string, limit: number = 50): Promise<RetellCallLog[]> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return [];
  }

  try {
    const filterCriteria: any = {};
    if (agentId) {
      filterCriteria.agent_id = [agentId];
    }

    const calls = await retellClient.call.list({
      filter_criteria: Object.keys(filterCriteria).length > 0 ? filterCriteria : undefined,
      limit,
      sort_order: 'descending',
    });

    return calls.map((call: any) => ({
      callId: call.call_id,
      agentId: call.agent_id,
      callType: call.call_type,
      callStatus: call.call_status,
      startTimestamp: call.start_timestamp,
      endTimestamp: call.end_timestamp,
      transcript: call.transcript,
      recordingUrl: call.recording_url,
      publicLogUrl: call.public_log_url,
      disconnectionReason: call.disconnection_reason,
      callAnalysis: call.call_analysis ? {
        callSuccessful: call.call_analysis.call_successful,
        callSummary: call.call_analysis.call_summary,
        userSentiment: call.call_analysis.user_sentiment,
      } : undefined,
      metadata: call.metadata,
    }));
  } catch (error) {
    console.error('[Retell] Error getting call logs:', error);
    return [];
  }
}

export async function getRetellCall(callId: string): Promise<RetellCallLog | null> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return null;
  }

  try {
    const call = await retellClient.call.retrieve(callId);
    return {
      callId: call.call_id,
      agentId: call.agent_id,
      callType: call.call_type,
      callStatus: call.call_status,
      startTimestamp: call.start_timestamp,
      endTimestamp: call.end_timestamp,
      transcript: call.transcript,
      recordingUrl: call.recording_url,
      publicLogUrl: call.public_log_url,
      disconnectionReason: call.disconnection_reason,
      callAnalysis: call.call_analysis ? {
        callSuccessful: call.call_analysis.call_successful,
        callSummary: call.call_analysis.call_summary,
        userSentiment: call.call_analysis.user_sentiment,
      } : undefined,
      metadata: call.metadata,
    };
  } catch (error) {
    console.error('[Retell] Error getting call:', error);
    return null;
  }
}

export async function listRetellPhoneNumbers(): Promise<RetellPhoneNumber[]> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return [];
  }

  try {
    const phoneNumbers = await retellClient.phoneNumber.list();
    return phoneNumbers.map((pn: any) => ({
      phoneNumber: pn.phone_number,
      phoneNumberPretty: pn.phone_number_pretty,
      inboundAgentId: pn.inbound_agent_id,
      outboundAgentId: pn.outbound_agent_id,
      areaCode: pn.area_code,
      nickname: pn.nickname,
      lastModificationTimestamp: pn.last_modification_timestamp,
    }));
  } catch (error) {
    console.error('[Retell] Error listing phone numbers:', error);
    return [];
  }
}

export async function importRetellPhoneNumber(
  phoneNumber: string,
  terminationUri: string,
  inboundAgentId?: string
): Promise<RetellPhoneNumber | null> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return null;
  }

  try {
    const pn = await retellClient.phoneNumber.import({
      phone_number: phoneNumber,
      termination_uri: terminationUri,
      inbound_agent_id: inboundAgentId,
    });

    return {
      phoneNumber: pn.phone_number,
      phoneNumberPretty: pn.phone_number_pretty,
      inboundAgentId: pn.inbound_agent_id,
      outboundAgentId: pn.outbound_agent_id,
      areaCode: pn.area_code,
      nickname: pn.nickname,
      lastModificationTimestamp: pn.last_modification_timestamp,
    };
  } catch (error) {
    console.error('[Retell] Error importing phone number:', error);
    throw error;
  }
}

export async function updateRetellPhoneNumber(
  phoneNumber: string,
  inboundAgentId?: string,
  outboundAgentId?: string,
  nickname?: string
): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    await retellClient.phoneNumber.update(phoneNumber, {
      inbound_agent_id: inboundAgentId,
      outbound_agent_id: outboundAgentId,
      nickname: nickname,
    });

    console.log('[Retell] Updated phone number:', phoneNumber);
    return true;
  } catch (error) {
    console.error('[Retell] Error updating phone number:', error);
    return false;
  }
}

export async function deleteRetellPhoneNumber(phoneNumber: string): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    await retellClient.phoneNumber.delete(phoneNumber);
    console.log('[Retell] Deleted phone number:', phoneNumber);
    return true;
  } catch (error) {
    console.error('[Retell] Error deleting phone number:', error);
    return false;
  }
}

export async function createRetellWebCall(agentId: string, metadata?: Record<string, unknown>): Promise<{
  callId: string;
  webCallLink: string;
  accessToken: string;
} | null> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return null;
  }

  try {
    const webCall = await retellClient.call.createWebCall({
      agent_id: agentId,
      metadata: metadata,
    });

    return {
      callId: webCall.call_id,
      webCallLink: webCall.web_call_link,
      accessToken: webCall.access_token,
    };
  } catch (error) {
    console.error('[Retell] Error creating web call:', error);
    throw error;
  }
}

export async function addKnowledgeToLLM(llmId: string, knowledgeBaseText: string): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    const currentLlm = await retellClient.llm.retrieve(llmId);
    const existingPrompt = currentLlm.general_prompt || '';
    
    const knowledgeSection = `

## Knowledge Base

${knowledgeBaseText}
`;

    const updatedPrompt = existingPrompt.includes('## Knowledge Base')
      ? existingPrompt.replace(/## Knowledge Base[\s\S]*$/, knowledgeSection.trim())
      : existingPrompt + knowledgeSection;

    await retellClient.llm.update(llmId, {
      general_prompt: updatedPrompt,
    });

    console.log('[Retell] Added knowledge to LLM:', llmId);
    return true;
  } catch (error) {
    console.error('[Retell] Error adding knowledge to LLM:', error);
    return false;
  }
}

export function formatKnowledgeBaseForRetell(items: Array<{ question: string; answer: string; category?: string }>): string {
  const grouped: Record<string, Array<{ question: string; answer: string }>> = {};
  
  for (const item of items) {
    const category = item.category || 'General';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push({ question: item.question, answer: item.answer });
  }

  let text = '';
  for (const [category, qaPairs] of Object.entries(grouped)) {
    text += `### ${category}\n\n`;
    for (const qa of qaPairs) {
      text += `**Q: ${qa.question}**\n${qa.answer}\n\n`;
    }
  }

  return text.trim();
}

export const RETELL_VOICE_PROVIDERS = {
  elevenlabs: {
    name: 'ElevenLabs',
    description: 'Premium voices with emotional range',
    voices: [
      { id: '11labs-Adrian', name: 'Adrian', gender: 'male' },
      { id: '11labs-Aria', name: 'Aria', gender: 'female' },
      { id: '11labs-Brian', name: 'Brian', gender: 'male' },
      { id: '11labs-Callum', name: 'Callum', gender: 'male' },
      { id: '11labs-Charlotte', name: 'Charlotte', gender: 'female' },
      { id: '11labs-Chris', name: 'Chris', gender: 'male' },
      { id: '11labs-Daniel', name: 'Daniel', gender: 'male' },
      { id: '11labs-Eric', name: 'Eric', gender: 'male' },
      { id: '11labs-George', name: 'George', gender: 'male' },
      { id: '11labs-Lily', name: 'Lily', gender: 'female' },
      { id: '11labs-Matilda', name: 'Matilda', gender: 'female' },
      { id: '11labs-Sarah', name: 'Sarah', gender: 'female' },
    ],
    models: ['eleven_turbo_v2', 'eleven_turbo_v2_5', 'eleven_flash_v2', 'eleven_flash_v2_5'],
  },
  openai: {
    name: 'OpenAI',
    description: 'Fast and reliable voices',
    voices: [
      { id: 'openai-Alloy', name: 'Alloy', gender: 'neutral' },
      { id: 'openai-Echo', name: 'Echo', gender: 'male' },
      { id: 'openai-Fable', name: 'Fable', gender: 'neutral' },
      { id: 'openai-Onyx', name: 'Onyx', gender: 'male' },
      { id: 'openai-Nova', name: 'Nova', gender: 'female' },
      { id: 'openai-Shimmer', name: 'Shimmer', gender: 'female' },
    ],
    models: [],
  },
  deepgram: {
    name: 'Deepgram',
    description: 'Speed optimized voices',
    voices: [
      { id: 'deepgram-Angus', name: 'Angus', gender: 'male' },
      { id: 'deepgram-Arcas', name: 'Arcas', gender: 'male' },
      { id: 'deepgram-Asteria', name: 'Asteria', gender: 'female' },
      { id: 'deepgram-Athena', name: 'Athena', gender: 'female' },
      { id: 'deepgram-Helios', name: 'Helios', gender: 'male' },
      { id: 'deepgram-Hera', name: 'Hera', gender: 'female' },
      { id: 'deepgram-Luna', name: 'Luna', gender: 'female' },
      { id: 'deepgram-Orion', name: 'Orion', gender: 'male' },
      { id: 'deepgram-Perseus', name: 'Perseus', gender: 'male' },
      { id: 'deepgram-Stella', name: 'Stella', gender: 'female' },
      { id: 'deepgram-Zeus', name: 'Zeus', gender: 'male' },
    ],
    models: [],
  },
  cartesia: {
    name: 'Cartesia',
    description: 'Ultra-low latency voices',
    voices: [
      { id: 'cartesia-Barbershop Man', name: 'Barbershop Man', gender: 'male' },
      { id: 'cartesia-British Lady', name: 'British Lady', gender: 'female' },
      { id: 'cartesia-California Girl', name: 'California Girl', gender: 'female' },
      { id: 'cartesia-Commercial Lady', name: 'Commercial Lady', gender: 'female' },
      { id: 'cartesia-Commercial Man', name: 'Commercial Man', gender: 'male' },
      { id: 'cartesia-Confident Man', name: 'Confident Man', gender: 'male' },
      { id: 'cartesia-Doctor Mischief', name: 'Doctor Mischief', gender: 'male' },
      { id: 'cartesia-Friendly Sidekick', name: 'Friendly Sidekick', gender: 'male' },
      { id: 'cartesia-Hannah', name: 'Hannah', gender: 'female' },
      { id: 'cartesia-Indian Lady', name: 'Indian Lady', gender: 'female' },
      { id: 'cartesia-Indian Man', name: 'Indian Man', gender: 'male' },
      { id: 'cartesia-Midwestern Woman', name: 'Midwestern Woman', gender: 'female' },
      { id: 'cartesia-Nonfiction Man', name: 'Nonfiction Man', gender: 'male' },
      { id: 'cartesia-Reflective Woman', name: 'Reflective Woman', gender: 'female' },
      { id: 'cartesia-Reporter Man', name: 'Reporter Man', gender: 'male' },
      { id: 'cartesia-Storyteller Lady', name: 'Storyteller Lady', gender: 'female' },
      { id: 'cartesia-Sweet Lady', name: 'Sweet Lady', gender: 'female' },
      { id: 'cartesia-Teacher Lady', name: 'Teacher Lady', gender: 'female' },
    ],
    models: ['sonic-english', 'sonic-multilingual'],
  },
  playht: {
    name: 'PlayHT',
    description: 'High quality voice cloning',
    voices: [
      { id: 'playht-Adolfo', name: 'Adolfo', gender: 'male' },
      { id: 'playht-Angelo', name: 'Angelo', gender: 'male' },
      { id: 'playht-Charlotte', name: 'Charlotte', gender: 'female' },
      { id: 'playht-Davis', name: 'Davis', gender: 'male' },
      { id: 'playht-Donna', name: 'Donna', gender: 'female' },
      { id: 'playht-Dylan', name: 'Dylan', gender: 'male' },
      { id: 'playht-Jack', name: 'Jack', gender: 'male' },
      { id: 'playht-Jennifer', name: 'Jennifer', gender: 'female' },
      { id: 'playht-Matt', name: 'Matt', gender: 'male' },
      { id: 'playht-Michael', name: 'Michael', gender: 'male' },
      { id: 'playht-Ruby', name: 'Ruby', gender: 'female' },
      { id: 'playht-Will', name: 'Will', gender: 'male' },
    ],
    models: ['PlayHT2.0', 'PlayHT2.0-turbo', 'Play3.0-mini'],
  },
} as const;

export const RETELL_LLM_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable, best quality', pricePerMin: 0.10 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable', pricePerMin: 0.07 },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic\'s latest', pricePerMin: 0.10 },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fast Claude model', pricePerMin: 0.07 },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous flagship', pricePerMin: 0.10 },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Legacy, fastest', pricePerMin: 0.05 },
] as const;

export const RETELL_AMBIENT_SOUNDS = [
  { id: 'coffee-shop', name: 'Coffee Shop' },
  { id: 'convention-hall', name: 'Convention Hall' },
  { id: 'summer-outdoor', name: 'Summer Outdoor' },
  { id: 'mountain-outdoor', name: 'Mountain Outdoor' },
  { id: 'static', name: 'Static' },
  { id: 'call-center', name: 'Call Center' },
] as const;

export const RETELL_LANGUAGES = [
  { id: 'en-US', name: 'English (US)' },
  { id: 'en-GB', name: 'English (UK)' },
  { id: 'es-ES', name: 'Spanish (Spain)' },
  { id: 'es-419', name: 'Spanish (Latin America)' },
  { id: 'fr-FR', name: 'French' },
  { id: 'de-DE', name: 'German' },
  { id: 'it-IT', name: 'Italian' },
  { id: 'pt-BR', name: 'Portuguese (Brazil)' },
  { id: 'pt-PT', name: 'Portuguese (Portugal)' },
  { id: 'zh-CN', name: 'Chinese (Mandarin)' },
  { id: 'ja-JP', name: 'Japanese' },
  { id: 'ko-KR', name: 'Korean' },
  { id: 'nl-NL', name: 'Dutch' },
  { id: 'pl-PL', name: 'Polish' },
  { id: 'ru-RU', name: 'Russian' },
  { id: 'hi-IN', name: 'Hindi' },
  { id: 'ar-SA', name: 'Arabic' },
  { id: 'tr-TR', name: 'Turkish' },
] as const;
