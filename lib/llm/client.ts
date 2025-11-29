/**
 * GitHub Model API Client
 * 
 * Provides access to various LLM models through GitHub's model API
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

/**
 * Create a chat completion using GitHub Model API
 */
export async function createChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
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
    const response = await fetch(GITHUB_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    
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
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
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

