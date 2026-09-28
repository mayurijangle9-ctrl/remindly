import { GoogleGenAI, Type } from '@google/genai';
import { format } from 'date-fns';
import {
  CustomInterval,
  IntervalUnit,
  Priority,
  ReminderDraft,
  RepeatType,
} from '@/types';
import { DEFAULT_CATEGORIES, DEFAULT_STICKERS } from '@/constants/seed';
import {
  assessLocalConfidence,
  parseNaturalLanguage,
} from './localParser';

export interface LlmParseOptions {
  apiKey?: string;
  forceLlm?: boolean;
  referenceDate?: Date;
}

export interface ParseResult {
  draft: ReminderDraft;
  source: 'gemini' | 'local_regex';
  confidence: number;
  reason?: string;
}

const CATEGORY_IDS = [
  'cat-bills',
  'cat-health',
  'cat-appointments',
  'cat-birthdays',
  'cat-subscriptions',
  'cat-vehicle',
  'cat-work',
  'cat-water',
  'cat-stretch',
  'cat-travel',
] as const;

/**
 * Resolves the active Gemini API key from explicit options or environment variables.
 */
export function getGeminiApiKey(explicitKey?: string): string | null {
  if (explicitKey && explicitKey.trim().length > 0) {
    return explicitKey.trim();
  }
  const envKey =
    process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (envKey && envKey.trim().length > 0) {
    return envKey.trim();
  }
  return null;
}

function defaultStickerForCategory(categoryId: string): string {
  const match = DEFAULT_STICKERS.find((s) => s.categoryId === categoryId);
  return match?.id || 'stk-bell';
}

/**
 * Direct Gemini API call with structured JSON output via @google/genai.
 * Returns null if network fails, offline, invalid key, or invalid response.
 */
export async function parseWithLlm(
  input: string,
  options?: LlmParseOptions
): Promise<ReminderDraft | null> {
  const apiKey = getGeminiApiKey(options?.apiKey);
  if (!apiKey) {
    return null;
  }

  const now = options?.referenceDate || new Date();
  const categoriesList = DEFAULT_CATEGORIES.map(
    (c) => `- ${c.id}: ${c.name}`
  ).join('\n');

  const systemPrompt = `You are Remindly's Agent. Convert natural language into a structured reminder.
Reference Date/Time: ${now.toISOString()} (${format(now, 'EEEE, MMMM d, yyyy h:mm a')}).

Available Categories:
${categoriesList}

Rules:
1. "title": Clean title without temporal words or scheduling commands. Capitalized.
2. "notes": Preserve specific details, URLs, or background context.
3. "dueAt": Calculated ISO 8601 UTC timestamp based on Reference Date/Time.
4. "categoryId": Best fit from the Available Categories list.
5. "priority": "High" if urgent/critical/asap, "Low" if casual, else "Medium".
6. "repeatType": "None" | "Daily" | "Weekly" | "Monthly" | "Yearly" | "CustomInterval".
7. If "repeatType" is "CustomInterval", supply "customIntervalEvery" (integer) and "customIntervalUnit" ("minutes"|"hours"|"days").`;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const callPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `${systemPrompt}\n\nUser request: "${input}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Clean reminder title, capitalized',
            },
            notes: {
              type: Type.STRING,
              description: 'Additional notes or context mentioned in user prompt',
            },
            dueAt: {
              type: Type.STRING,
              description: 'ISO 8601 UTC timestamp calculated from reference time',
            },
            categoryId: {
              type: Type.STRING,
              description: 'One of the valid category IDs',
            },
            priority: {
              type: Type.STRING,
              description: 'Low, Medium, or High',
            },
            repeatType: {
              type: Type.STRING,
              description:
                'None, Daily, Weekly, Monthly, Yearly, or CustomInterval',
            },
            customIntervalEvery: {
              type: Type.INTEGER,
              description:
                'Interval number step when repeatType is CustomInterval',
            },
            customIntervalUnit: {
              type: Type.STRING,
              description: 'minutes, hours, or days',
            },
          },
          required: ['title', 'dueAt', 'categoryId', 'priority', 'repeatType'],
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Gemini API call exceeded 3500ms timeout limit')),
        3500
      )
    );

    const response = await Promise.race([callPromise, timeoutPromise]);

    const rawJson = response.text?.trim();
    if (!rawJson) return null;

    const data = JSON.parse(rawJson);
    if (!data.title || !data.dueAt) return null;

    // Validate categoryId
    const validCatId = CATEGORY_IDS.includes(data.categoryId)
      ? data.categoryId
      : 'cat-work';

    // Validate priority
    const validPriority: Priority = ['Low', 'Medium', 'High'].includes(
      data.priority
    )
      ? data.priority
      : 'Medium';

    // Validate repeatType
    const validRepeat: RepeatType = [
      'None',
      'Daily',
      'Weekly',
      'Monthly',
      'Yearly',
      'CustomInterval',
    ].includes(data.repeatType)
      ? data.repeatType
      : 'None';

    let customInterval: CustomInterval | undefined;
    if (
      validRepeat === 'CustomInterval' &&
      typeof data.customIntervalEvery === 'number'
    ) {
      const unit: IntervalUnit = ['minutes', 'hours', 'days'].includes(
        data.customIntervalUnit
      )
        ? data.customIntervalUnit
        : 'hours';
      customInterval = {
        every: Math.max(1, data.customIntervalEvery),
        unit,
      };
    }

    const cat = DEFAULT_CATEGORIES.find((c) => c.id === validCatId);

    const draft: ReminderDraft = {
      title: data.title,
      notes: data.notes || `Created via Gemini AI from: "${input}"`,
      dueAt: new Date(data.dueAt).toISOString(),
      categoryId: validCatId,
      categoryName: cat?.name,
      priority: validPriority,
      repeatType: validRepeat,
      customInterval,
      stickerId: defaultStickerForCategory(validCatId),
    };

    return draft;
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[llmProvider] Gemini API parse encountered error; falling back to local regex:',
        error instanceof Error ? error.message : String(error)
      );
    }
    return null;
  }
}

/**
 * Intelligent hybrid parser:
 * 1. Checks local confidence. If deterministic regex is confident and LLM not forced,
 *    it runs instantaneously on-device with zero network latency.
 * 2. If regex confidence is low (complex dates, multi-clause intent, unrecognized category)
 *    or LLM is forced, it invokes Gemini 3.8 Flash.
 * 3. If offline or Gemini fails for any reason, it automatically falls back to local parser.
 */
export async function parseWithHybridFallback(
  input: string,
  options?: LlmParseOptions
): Promise<ParseResult> {
  const localConfidence = assessLocalConfidence(input);
  const hasKey = !!getGeminiApiKey(options?.apiKey);

  // If local confidence is high and LLM not forced, use deterministic parser
  if (!options?.forceLlm && !localConfidence.isLowConfidence) {
    return {
      draft: parseNaturalLanguage(input),
      source: 'local_regex',
      confidence: localConfidence.confidence,
      reason: 'High confidence local deterministic match.',
    };
  }

  // If we have an API key, attempt Gemini parsing
  if (hasKey) {
    try {
      const llmDraft = await parseWithLlm(input, options);
      if (llmDraft) {
        return {
          draft: llmDraft,
          source: 'gemini',
          confidence: 0.95,
          reason: 'Structured output from Gemini 3.8 Flash.',
        };
      }
    } catch {
      // Fallback below
    }
  }

  // Graceful offline / fallback to local regex parser
  const fallbackDraft = parseNaturalLanguage(input);
  return {
    draft: fallbackDraft,
    source: 'local_regex',
    confidence: localConfidence.confidence,
    reason: hasKey
      ? 'Gemini unavailable/offline; fell back to local regex.'
      : 'No Gemini API key configured; used local regex.',
  };
}

export const llmProvider = {
  getGeminiApiKey,
  parseWithLlm,
  parseWithHybridFallback,
};
