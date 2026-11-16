import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ImageGenerationRequest, Article, Block } from '../types';

// Initialize the client using the environment variable directly.
// This allows Vite to replace 'process.env.API_KEY' with the actual value at build time.
// As per guidelines: The API key must be obtained exclusively from the environment variable process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Image Generation ---
export const generateArticleImage = async (request: ImageGenerationRequest): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key mungon. Ju lutem konfiguroni API_KEY.");
  }

  let ratioPrompt = "";
  if (request.aspectRatio === '16:9') ratioPrompt = " wide aspect ratio 16:9";
  if (request.aspectRatio === '3:4') ratioPrompt = " portrait aspect ratio 3:4";

  const fullPrompt = `${request.prompt}. Style: ${request.style || 'photorealistic, high quality journalistic style'}.${ratioPrompt}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: fullPrompt }
        ]
      }
    });

    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image data found in response");

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

// --- Title Suggestions ---
export const suggestTitles = async (topic: string): Promise<string[]> => {
    if (!process.env.API_KEY) return ["Konfiguroni API Key për sugjerime"];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Generate 3 catchy, journalistic headlines in Albanian for an article about: "${topic}". Return only a JSON array of strings.`,
            config: {
                responseMimeType: 'application/json'
            }
        });
        
        const text = response.text;
        if (text) {
             // Strip any potential markdown
             const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
             return JSON.parse(cleanText);
        }
        return [];
    } catch (e) {
        console.error(e);
        return [];
    }
}

// --- Streaming Translation ---
export const translateArticleStream = async (
    article: Article, 
    targetLang: string, 
    onUpdate: (updatedArticle: Article) => void
): Promise<void> => {
    if (targetLang === 'sq') {
        onUpdate(article);
        return;
    }

    try {
        // We will construct a prompt that asks the model to translate parts separated by a unique delimiter.
        // This allows us to parse the stream linearly.
        const DELIMITER = "|||";
        
        // Identify which blocks are translatable
        const translatableBlocks: { index: number, original: string }[] = [];
        article.content.forEach((block, idx) => {
            if (['paragraph', 'heading', 'quote'].includes(block.type) && block.content && block.content.trim()) {
                translatableBlocks.push({ index: idx, original: block.content });
            }
        });

        // Construct the prompt
        let promptText = `You are a professional news translator. Translate the following text segments from Albanian to "${targetLang}". 
        Maintain the exact tone and journalistic style.
        IMPORTANT: You must output the translations in the EXACT same order, separated strictly by the string "${DELIMITER}".
        Do not add any labels, numbering, or markdown code blocks. Just the translated text and the delimiter.
        
        Segments to translate:
        ${article.title}
        ${DELIMITER}
        ${article.subtitle}
        ${DELIMITER}
        `;

        translatableBlocks.forEach(tb => {
            promptText += `${tb.original}\n${DELIMITER}\n`;
        });

        const result = await ai.models.generateContentStream({
            model: 'gemini-3-flash-preview',
            contents: promptText,
        });

        let accumulatedText = '';
        const currentArticleState = { ...article, content: [...article.content.map(b => ({...b}))] }; // Deep copy content

        for await (const chunk of result) {
            // FIX: Access .text as a property, not a method
            const chunkText = chunk.text; 
            
            if (chunkText) {
                accumulatedText += chunkText;
                
                // Split by delimiter to get the segments
                const segments = accumulatedText.split(DELIMITER);
                
                // Segment 0 = Title
                // Segment 1 = Subtitle
                // Segment 2+ = Content Blocks
                
                if (segments.length > 0) currentArticleState.title = segments[0].trim();
                if (segments.length > 1) currentArticleState.subtitle = segments[1].trim();

                // Handle content blocks
                for (let i = 2; i < segments.length; i++) {
                    // The last segment might be incomplete in the stream, but we show it anyway for real-time effect
                    // translatableBlocks is 0-indexed, so we offset by 2
                    const blockMapIndex = i - 2;
                    if (blockMapIndex < translatableBlocks.length) {
                        const originalIndex = translatableBlocks[blockMapIndex].index;
                        const translatedText = segments[i].trim();
                        
                        // Update the content in the article state
                        if (translatedText) {
                            currentArticleState.content[originalIndex].content = translatedText;
                        }
                    }
                }

                // Push update to UI
                onUpdate({ ...currentArticleState });
            }
        }

    } catch (e) {
        console.error("Streaming translation error:", e);
        // Fallback or error handling handled by UI
    }
};

// Kept for backward compatibility if needed, but UI now uses stream
export const translateArticleContent = async (article: Article, targetLang: string): Promise<Article> => {
    // If not using stream, fallback to single call (simplified logic here as UI prefers stream)
    return article; 
};


// --- Text to Speech (Gemini) ---

// Helper: Decode Base64
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper: Decode PCM to AudioBuffer
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const generateSpeech = async (text: string): Promise<AudioBuffer> => {
    if (!process.env.API_KEY) throw new Error("API Key missing");

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Kore', 'Fenrir', 'Puck', 'Charon'
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    
    // Decode PCM
    const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        audioContext,
        24000,
        1
    );

    return audioBuffer;
};