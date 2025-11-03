
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MENU } from "../constants";
import { OrderItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const parseOrderFromText = async (text: string): Promise<OrderItem[]> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Analiza el siguiente texto de un pedido y conviértelo en un formato JSON basado en el menú proporcionado. El texto del pedido es: "${text}". El menú es: ${JSON.stringify(MENU)}. Devuelve solo un array de objetos JSON, donde cada objeto representa un ítem del pedido con "id", "nombre", "cantidad", y "precioUnitario". Si un ítem mencionado no está en el menú, ignóralo. Si no se puede extraer ningún pedido, devuelve un array vacío.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.INTEGER },
                            nombre: { type: Type.STRING },
                            cantidad: { type: Type.INTEGER },
                            precioUnitario: { type: Type.NUMBER },
                        },
                        required: ["id", "nombre", "cantidad", "precioUnitario"],
                    },
                },
            },
        });

        const jsonResponse = JSON.parse(response.text);
        if (Array.isArray(jsonResponse)) {
            return jsonResponse as OrderItem[];
        }
        return [];

    } catch (error) {
        console.error("Error parsing order:", error);
        return [];
    }
};


export const generateOrderConfirmationAudio = async (orderSummaryText: string): Promise<string | null> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Confirmando pedido: ${orderSummaryText}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio || null;
    } catch (error) {
        console.error("Error generating audio:", error);
        return null;
    }
};

// --- Audio Decoding Utilities ---

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
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
