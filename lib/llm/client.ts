/**
 * GitHub Model API Client
 * 
 * Provides access to various LLM models through GitHub's model API
 * Includes rate limiting to avoid 429 errors
 */

import type { AgentModel } from "@/types";
import { GITHUB_MODEL_ENDPOINTS } from "@/types/agents";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionOptions {
  model: AgentModel;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
}

interface ChatCompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const GITHUB_API_URL = "https://models.github.ai/inference/chat/completions";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Rate limiting configuration
// GitHub Models has strict rate limits - space out requests
const MIN_REQUEST_INTERVAL_MS = 3000; // Minimum 3 seconds between requests
let lastRequestTime = 0;

/**
 * Wait for rate limit and queue requests
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
    console.log(`[LLM] Rate limiting: waiting ${waitTime}ms before next request`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Create a chat completion using Gemini API (fallback)
 */
async function createGeminiCompletion(
  options: ChatCompletionOptions,
  originalModel: AgentModel
): Promise<ChatCompletionResponse> {
  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_KEY not configured for Gemini fallback");
  }

  const { messages, temperature = 0.7, maxTokens = 1000, responseFormat } = options;

  // Convert messages to Gemini format
  // Combine system and user messages into a single prompt
  const systemMessage = messages.find(m => m.role === "system");
  const userMessages = messages.filter(m => m.role !== "system");

  let prompt = "";
  if (systemMessage) {
    prompt = `${systemMessage.content}\n\n`;
  }

  // Add user messages
  for (const msg of userMessages) {
    if (msg.role === "user") {
      prompt += `${msg.content}\n\n`;
    } else if (msg.role === "assistant") {
      prompt += `Assistant: ${msg.content}\n\n`;
    }
  }

  // Add JSON format instruction if needed
  if (responseFormat === "json_object") {
    prompt += "\n\nRespond ONLY with valid JSON, no other text.";
  }

  const body = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: responseFormat === "json_object" ? "application/json" : "text/plain",
    },
  };

  try {
    console.log(`[LLM] ⚠️ Rate limit detected! Using Gemini fallback for ${originalModel} agent`);
    console.log(`[LLM] Gemini will act as ${originalModel} using the same personality and decision-making style`);
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log(`[LLM] ✅ Gemini fallback responded successfully (acting as ${originalModel})`);

    return {
      content,
      model: `gemini-2.0-flash-exp (fallback for ${originalModel})`,
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined,
    };
  } catch (error) {
    console.error(`[LLM] Error calling Gemini fallback:`, error);
    throw error;
  }
}

/**
 * Create a chat completion using GitHub Model API
 */
export async function createChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  // Wait for rate limit before proceeding
  await waitForRateLimit();

  const { model, messages, temperature = 0.7, maxTokens = 1000, responseFormat } = options;

  const modelEndpoint = GITHUB_MODEL_ENDPOINTS[model];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
  };

  const body: Record<string, unknown> = {
    model: modelEndpoint,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  try {
    console.log(`[LLM] Calling ${model} (${modelEndpoint})`);
    const response = await fetch(GITHUB_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();

      // Handle rate limit specifically
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        throw new RateLimitError(
          `Rate limited. Retry after: ${retryAfter || 'unknown'}`,
          parseInt(retryAfter || '10', 10)
        );
      }

      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log(`[LLM] ${model} responded successfully`);

    return {
      content: data.choices[0]?.message?.content || "",
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  } catch (error) {
    console.error(`[LLM] Error calling ${model}:`, error);
    throw error;
  }
}

/**
 * Custom error for rate limiting
 */
export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

/**
 * Create a chat completion using DeepSeek API (fallback)
 */
async function createDeepSeekCompletion(
  options: ChatCompletionOptions,
  originalModel: AgentModel
): Promise<ChatCompletionResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured for DeepSeek fallback");
  }

  const { messages, temperature = 0.7, maxTokens = 1000, responseFormat } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };

  const body: Record<string, unknown> = {
    model: "deepseek-chat",
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  try {
    console.log(`[LLM] ⚠️ Rate limit detected! Using DeepSeek fallback for ${originalModel} agent`);
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log(`[LLM] ✅ DeepSeek fallback responded successfully`);

    return {
      content: data.choices[0]?.message?.content || "",
      model: `deepseek-chat (fallback for ${originalModel})`,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  } catch (error) {
    console.error(`[LLM] Error calling DeepSeek fallback:`, error);
    throw error;
  }
}

/**
 * Create a completion with retry logic and fallbacks
 */
export async function createChatCompletionWithRetry(
  options: ChatCompletionOptions,
  maxRetries = 3
): Promise<ChatCompletionResponse> {
  let lastError: Error | null = null;
  let usedFallback = false;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await createChatCompletion(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[LLM] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

      // If rate limited or model not found (404), try fallbacks immediately
      const errorMessage = error instanceof Error ? error.message : String(error);
      if ((error instanceof RateLimitError || errorMessage.includes("404")) && !usedFallback) {
        // Try DeepSeek first (if configured and not the failing model)
        if (process.env.DEEPSEEK_API_KEY && options.model !== "deepseek") {
          console.log(`[LLM] Issue with ${options.model}, falling back to DeepSeek...`);
          try {
            usedFallback = true;
            return await createDeepSeekCompletion(options, options.model);
          } catch (fallbackError) {
            console.error(`[LLM] DeepSeek fallback failed:`, fallbackError);
            // Continue to Gemini fallback
          }
        }

        // Try Gemini second (if configured)
        if (process.env.GOOGLE_AI_KEY) {
          console.log(`[LLM] Issue with ${options.model}, falling back to Gemini...`);
          try {
            usedFallback = true;
            return await createGeminiCompletion(options, options.model);
          } catch (fallbackError) {
            console.error(`[LLM] Gemini fallback failed:`, fallbackError);
          }
        }
      }

      if (attempt < maxRetries) {
        // Handle rate limit errors with longer wait
        if (error instanceof RateLimitError) {
          const waitTime = Math.min(error.retryAfterSeconds * 1000, 60000); // Cap at 60 seconds
          console.log(`[LLM] Rate limited. Waiting ${Math.floor(waitTime / 1000)}s before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          // Exponential backoff for other errors (starting at 4s, then 8s)
          const backoffTime = Math.pow(2, attempt + 1) * 1000;
          console.log(`[LLM] Waiting ${backoffTime / 1000}s before retry...`);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }
      }
    }
  }

  // Final fallback attempts if all retries failed
  if (!usedFallback) {
    if (process.env.DEEPSEEK_API_KEY) {
      console.log(`[LLM] All retries failed, using DeepSeek as final fallback...`);
      try {
        return await createDeepSeekCompletion(options, options.model);
      } catch (e) { console.error(e); }
    }

    if (process.env.GOOGLE_AI_KEY) {
      console.log(`[LLM] All retries failed, using Gemini as final fallback...`);
      try {
        return await createGeminiCompletion(options, options.model);
      } catch (e) { console.error(e); }
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

/**
 * Parse JSON from LLM response, handling potential issues
 */
export function parseJsonResponse<T>(content: string): T {
  // Try to extract JSON from the response
  let jsonStr = content.trim();

  // Remove markdown code blocks if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Try to find JSON object
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    console.error("[LLM] Failed to parse JSON:", content);
    throw new Error("Failed to parse LLM response as JSON");
  }
}

/**
 * Check if the GitHub token is configured
 */
export function isConfigured(): boolean {
  return !!process.env.GITHUB_TOKEN;
}

/**
 * Get available models
 */
export function getAvailableModels(): AgentModel[] {
  return Object.keys(GITHUB_MODEL_ENDPOINTS) as AgentModel[];
}

