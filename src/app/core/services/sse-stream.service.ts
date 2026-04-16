import { Injectable } from '@angular/core';
import { StreamingResponse } from '../../shared/models/ai-chat.model';

@Injectable({ providedIn: 'root' })
export class SseStreamService {
  private readonly streamTimeoutMs = 120000;

  async parseStream(
    stream: ReadableStream<Uint8Array> | null,
    onToken?: (token: string) => void,
    onDone?: (response: StreamingResponse) => void,
    onError?: (error: string) => void,
    onThinking?: (thinking: string) => void,
    onToolCalled?: (toolCall: any) => void,
    abortSignal?: AbortSignal
  ): Promise<StreamingResponse> {
    if (!stream) {
      throw new Error('No se pudo iniciar el stream SSE');
    }

    const result: StreamingResponse = {
      tokens: [],
      fullResponse: '',
      inputTokens: 0,
      outputTokens: 0,
      completed: false,
      thinkingContent: '',
      toolCalls: []
    };

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const timeoutId = setTimeout(() => {
      reader.cancel('timeout');
    }, this.streamTimeoutMs);

    try {
      while (true) {
        if (abortSignal?.aborted) {
          await reader.cancel('aborted');
          break;
        }

        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        let separatorIndex = buffer.indexOf('\n\n');
        while (separatorIndex !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);

          this.processEvent(rawEvent, result, onToken, onDone, onError, onThinking, onToolCalled);
          separatorIndex = buffer.indexOf('\n\n');
        }
      }

      // Process trailing event if stream ended without final separator
      if (buffer.trim()) {
        this.processEvent(buffer, result, onToken, onDone, onError, onThinking, onToolCalled);
      }

      if (!result.completed) {
        result.completed = true;
        onDone?.(result);
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.error = message;
      onError?.(message);
      throw error;
    } finally {
      clearTimeout(timeoutId);
      reader.releaseLock();
    }
  }

  private processEvent(
    rawEvent: string,
    result: StreamingResponse,
    onToken?: (token: string) => void,
    onDone?: (response: StreamingResponse) => void,
    onError?: (error: string) => void,
    onThinking?: (thinking: string) => void,
    onToolCalled?: (toolCall: any) => void
  ): void {
    const lines = rawEvent
      .split('\n')
      .map(line => line.trimEnd())
      .filter(line => line.length > 0);

    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        // Preserve spaces after 'data:' prefix
        dataLines.push(line.slice(5));
      }
    }

    const rawData = dataLines.join('\n');

    // Backend usually emits plain token string for token events and empty data for done.
    if (eventName === 'token') {
      const parsed = this.tryParseJson(rawData);
      const token = typeof parsed?.['data'] === 'string'
        ? parsed['data']
        : rawData;

      if (!token) {
        return;
      }

      result.tokens.push(token);
      result.fullResponse += token;
      onToken?.(token);
      return;
    }

    if (eventName === 'done') {
      const parsed = this.tryParseJson(rawData);
      if (parsed?.['fullResponse']) {
        result.fullResponse = parsed['fullResponse'] as string;
      }
      if (typeof parsed?.['inputTokens'] === 'number') {
        result.inputTokens = parsed['inputTokens'] as number;
      }
      if (typeof parsed?.['outputTokens'] === 'number') {
        result.outputTokens = parsed['outputTokens'] as number;
      }

      result.completed = true;
      onDone?.(result);
      return;
    }

    if (eventName === 'error') {
      const parsed = this.tryParseJson(rawData);
      const message = typeof parsed?.['data'] === 'string'
        ? (parsed['data'] as string)
        : rawData || 'Error en stream SSE';

      result.error = message;
      onError?.(message);
      throw new Error(message);
    }

    if (eventName === 'thinking' || eventName === 'thinking_delta') {
      const thinkingChunk = rawData;
      if (result.thinkingContent) {
        result.thinkingContent += thinkingChunk;
      } else {
        result.thinkingContent = thinkingChunk;
      }
      onThinking?.(thinkingChunk);
      return;
    }

    if (eventName === 'tool_called') {
      const parsed = this.tryParseJson(rawData);
      const toolName = parsed?.['toolName'] ?? rawData;
      const toolCall = { toolName };
      result.toolCalls?.push(toolCall);
      onToolCalled?.(toolCall);
      return;
    }

    if (eventName === 'tool_result') {
      const parsed = this.tryParseJson(rawData);
      const toolResult = parsed?.['toolResult'] ?? rawData;
      if (result.toolCalls && result.toolCalls.length > 0) {
        result.toolCalls[result.toolCalls.length - 1].toolResult = toolResult;
      }
      return;
    }
  }

  private tryParseJson(rawData: string): Record<string, any> | null {
    if (!rawData || !rawData.startsWith('{')) {
      return null;
    }

    try {
      return JSON.parse(rawData) as Record<string, any>;
    } catch {
      return null;
    }
  }
}
