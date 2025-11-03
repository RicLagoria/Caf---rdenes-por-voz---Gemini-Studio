

import React, { useState, useRef, useCallback, useEffect } from 'react';
// FIX: Removed non-exported 'LiveSession' type.
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";
import { OrderItem } from './types';
import { parseOrderFromText, generateOrderConfirmationAudio, decode, decodeAudioData } from './services/geminiService';
import MenuDisplay from './components/MenuDisplay';
import OrderSummary from './components/OrderSummary';

// --- Helper functions for audio encoding ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}


const App: React.FC = () => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [status, setStatus] = useState<string>('Listo para tomar tu pedido');
    const [transcribedText, setTranscribedText] = useState<string>('');
    const [order, setOrder] = useState<OrderItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // FIX: Replaced 'LiveSession' with 'any' as the type is not exported.
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const stopRecordingAndProcess = useCallback(async (finalTranscription: string) => {
        setIsRecording(false);
        setIsLoading(true);
        setStatus('Procesando tu pedido...');
        
        if (sessionPromiseRef.current) {
            const session = await sessionPromiseRef.current;
            session.close();
            sessionPromiseRef.current = null;
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if(audioContextRef.current && audioContextRef.current.state !== 'closed') {
            await audioContextRef.current.close();
            audioContextRef.current = null;
        }

        if (!finalTranscription.trim()) {
            setStatus('No detectamos ningún pedido. Intenta de nuevo.');
            setIsLoading(false);
            setTranscribedText('');
            return;
        }
        
        const processedOrder = await parseOrderFromText(finalTranscription);
        setOrder(processedOrder);

        if (processedOrder.length > 0) {
            const orderSummaryText = processedOrder.map(item => `${item.cantidad} ${item.nombre}`).join(', ');
            setStatus('Confirmando tu pedido...');
            const audioData = await generateOrderConfirmationAudio(orderSummaryText);
            if (audioData) {
                // FIX: Cast window to 'any' to support 'webkitAudioContext' for broader browser compatibility.
                const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                const decodedBytes = decode(audioData);
                const audioBuffer = await decodeAudioData(decodedBytes, outputAudioContext, 24000, 1);
                const source = outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputAudioContext.destination);
                source.start();
                source.onended = () => {
                    outputAudioContext.close();
                }
            }
            setStatus('¡Pedido confirmado!');
        } else {
            setStatus('No pudimos entender tu pedido del menú. Por favor, intenta de nuevo.');
        }

        setIsLoading(false);

    }, []);

    const startRecording = useCallback(async () => {
        if (isRecording) return;
        
        setOrder([]);
        setTranscribedText('');
        let currentTranscription = '';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            // FIX: Cast window to 'any' to support 'webkitAudioContext' for broader browser compatibility.
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setIsRecording(true);
                        setStatus('¡Te escucho! Dime qué deseas ordenar...');
                        mediaStreamSourceRef.current = audioContextRef.current!.createMediaStreamSource(stream);
                        scriptProcessorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };

                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(audioContextRef.current!.destination);
                    },
                    onmessage: (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            currentTranscription += text;
                            setTranscribedText(currentTranscription);
                        }
                        if (message.serverContent?.turnComplete) {
                            stopRecordingAndProcess(currentTranscription);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('API Error:', e);
                        setStatus('Hubo un error en la conexión. Intenta de nuevo.');
                        stopRecordingAndProcess(currentTranscription);
                    },
                    onclose: (e: CloseEvent) => {
                       // console.log('Connection closed.');
                    },
                },
                config: {
                    inputAudioTranscription: {},
                    // FIX: The Live API requires responseModalities to be set to [Modality.AUDIO].
                    responseModalities: [Modality.AUDIO]
                }
            });

        } catch (error) {
            console.error('Error starting recording:', error);
            setStatus('No se pudo acceder al micrófono.');
        }
    }, [isRecording, stopRecordingAndProcess]);

    const handleMicButtonClick = () => {
        if (isRecording) {
            stopRecordingAndProcess(transcribedText);
        } else {
            startRecording();
        }
    };
    
    const clearOrder = () => {
        setOrder([]);
        setTranscribedText('');
        setStatus('Listo para tomar tu pedido');
    }

    const MicIcon = ({ recording }: { recording: boolean }) => (
      <svg className={`w-8 h-8 ${recording ? 'text-red-500' : 'text-white'}`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path>
        <path d="M17 11h-1c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92z"></path>
      </svg>
    );

    return (
        <div className="min-h-screen bg-amber-50 text-gray-800 font-sans p-4 sm:p-8">
            <header className="text-center mb-8">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-amber-900">Café Órdenes por Voz</h1>
                <p className="text-lg text-gray-600 mt-2">Pide con tu voz, nosotros nos encargamos del resto.</p>
            </header>

            <main className="flex flex-col items-center">
                {order.length === 0 && !isRecording && !isLoading && <MenuDisplay />}

                <div className="mt-8 w-full max-w-2xl text-center p-6 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg">
                    <p className="text-xl font-medium mb-4">{status}</p>

                    { (isRecording || isLoading || transcribedText) && !order.length && (
                        <div className="min-h-[6rem] bg-gray-100 rounded-lg p-4 text-left text-gray-700 italic border">
                            {transcribedText || "..."}
                        </div>
                    )}

                    <div className="mt-6 flex justify-center">
                         <button
                            onClick={handleMicButtonClick}
                            disabled={isLoading}
                            className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-4 focus:ring-opacity-50
                                ${isRecording ? 'bg-red-200 focus:ring-red-400 animate-pulse' : 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-400'}
                                ${isLoading ? 'bg-gray-400 cursor-not-allowed' : ''}
                            `}
                        >
                            <MicIcon recording={isRecording} />
                        </button>
                    </div>
                </div>

                {order.length > 0 && <OrderSummary order={order} onClear={clearOrder}/>}

            </main>
        </div>
    );
};

export default App;
