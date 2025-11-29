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

/**
 * Create a completion with retry logic
 */
export async function createChatCompletionWithRetry(
  options: ChatCompletionOptions,
  maxRetries = 3
): Promise<ChatCompletionResponse> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await createChatCompletion(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[LLM] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        // Handle rate limit errors with longer wait
        if (error instanceof RateLimitError) {
          const waitTime = error.retryAfterSeconds * 1000;
          console.log(`[LLM] Rate limited. Waiting ${error.retryAfterSeconds}s before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          // Exponential backoff for other errors (starting at 4s, then 8s)
          const backoffTime = Math.pow(2, attempt + 1) * 1000;
          console.log(`[LLM] Waiting ${backoffTime/1000}s before retry...`);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }
      }
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

