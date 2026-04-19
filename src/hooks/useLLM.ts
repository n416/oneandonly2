import { useState } from 'react';

export type Provider = 'gemini' | 'local';

export interface LLMConfig {
  provider: Provider;
  geminiApiKey?: string;
  localEndpoint?: string; // Default to http://127.0.0.1:8000/api/chat-stream
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export function useLLM() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateResponse = async (
    systemPrompt: string,
    history: ChatMessage[],
    configOverride?: LLMConfig,
    onChunk?: (text: string) => void
  ): Promise<string> => {
    setIsGenerating(true);
    let fullText = '';
    
    // configOverrideがなければ localStorage から取得、なければデフォルト設定
    let config = configOverride;
    if (!config) {
      try {
        const stored = localStorage.getItem('llm_config');
        if (stored) {
          config = JSON.parse(stored);
        }
      } catch (e) {
        console.error('Failed to parse llm_config', e);
      }
      if (!config) {
        config = { provider: 'gemini' }; // デフォルトをGeminiにする
      }
    }
    
    try {
      if (config.provider === 'local') {
        const endpoint = config.localEndpoint || 'http://127.0.0.1:8000/api/chat-stream';
        
        // 自作 llm-api の仕様に合わせて、プロンプトを文字列に平坦化する
        const messageText = history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.parts[0].text}`).join('\n') + '\nAssistant:';
        const fullPrompt = `${systemPrompt}\n\n${messageText}`;

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: fullPrompt, max_tokens: 4096 })
        });

        if (!res.ok) throw new Error(`Local API error: ${res.statusText}`);
        
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;
            if (onChunk) onChunk(chunk);
          }
        }

      } else {
        // Gemini API モード
        if (!config.geminiApiKey) throw new Error('Gemini API Key is missing');
        const apiKey = config.geminiApiKey.trim();
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`;
        
        const bodyData: any = {
          contents: history.length > 0 ? history : [{ role: 'user', parts: [{ text: systemPrompt }] }],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        };
        if (history.length > 0 && systemPrompt) {
          bodyData.systemInstruction = { parts: [{ text: systemPrompt }] };
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyData),
        });

        if (!res.ok) {
          if (res.status === 429) {
             throw new Error('APIの利用制限（1分間に15回まで）に到達しました。1分ほど待ってから再度お試しください。');
          }
          throw new Error('Gemini API error: ' + await res.text());
        }
        
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            
            let newlineIdx;
            while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, newlineIdx).trim();
              buffer = buffer.slice(newlineIdx + 1);
              
              if (line.startsWith('data: ')) {
                try {
                  const dataStr = line.substring(6);
                  if (dataStr === '[DONE]') continue;
                  
                  const json = JSON.parse(dataStr);
                  if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
                    const textPart = json.candidates[0].content.parts[0].text;
                    fullText += textPart;
                    if (onChunk) onChunk(textPart);
                  }
                } catch (e) {
                  console.warn("Gemini stream parse error:", e);
                }
              }
            }
          }
        }
      }
      return fullText;
    } finally {
      setIsGenerating(false);
    }
  };

  return { generateResponse, isGenerating };
}
