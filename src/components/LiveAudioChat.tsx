import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, PhoneOff, PhoneCall, Loader2, Volume2 } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface LiveAudioChatProps {
  onClose: () => void;
}

export default function LiveAudioChat({ onClose }: LiveAudioChatProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const startSession = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      setTranscript('Connecting to AI Doctor...');

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: async () => {
            setIsConnected(true);
            setIsConnecting(false);
            setTranscript('Connected! Listening...');
            
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              streamRef.current = stream;
              
              if (!audioContextRef.current) return;
              
              const source = audioContextRef.current.createMediaStreamSource(stream);
              sourceRef.current = source;
              
              const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;
              
              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                  pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                }
                
                const buffer = new Uint8Array(pcmData.buffer);
                let binary = '';
                for (let i = 0; i < buffer.byteLength; i++) {
                  binary += String.fromCharCode(buffer[i]);
                }
                const base64Data = btoa(binary);
                
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({
                    media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                  });
                });
              };
              
              source.connect(processor);
              processor.connect(audioContextRef.current.destination);
            } catch (err) {
              console.error("Microphone error:", err);
              setError("Could not access microphone.");
              stopSession();
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              playAudioChunk(base64Audio);
            }
            
            // Handle interruption
            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              if (currentSourceRef.current) {
                currentSourceRef.current.stop();
                currentSourceRef.current = null;
              }
              isPlayingRef.current = false;
            }
            
            // Handle transcription (model output)
            // Note: The SDK might structure transcription differently depending on the exact version,
            // but we can try to extract text if it's provided in parts or as a specific transcription event.
            const textPart = message.serverContent?.modelTurn?.parts?.find(p => p.text);
            if (textPart?.text) {
              setTranscript(prev => prev + ' ' + textPart.text);
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection error occurred.");
            stopSession();
          },
          onclose: () => {
            stopSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are a helpful, empathetic medical AI assistant for patients in Bihar, India. You can understand Hindi, English, and Magahi. Keep your responses concise, clear, and focused on providing immediate advice or determining if they need an ambulance. Always advise them to see a real doctor for serious issues.",
        },
      });
      
      sessionRef.current = await sessionPromise;
      
    } catch (err: any) {
      console.error("Failed to start session:", err);
      setError(err.message || "Failed to connect to AI.");
      setIsConnecting(false);
    }
  };

  const playAudioChunk = (base64Audio: string) => {
    if (!audioContextRef.current) return;
    
    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }
      
      audioQueueRef.current.push(float32);
      playNext();
    } catch (err) {
      console.error("Error decoding audio chunk:", err);
    }
  };

  const playNext = () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0 || !audioContextRef.current) return;
    
    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift()!;
    
    // Gemini Live API returns 24kHz audio
    const buffer = audioContextRef.current.createBuffer(1, audioData.length, 24000);
    buffer.getChannelData(0).set(audioData);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      isPlayingRef.current = false;
      currentSourceRef.current = null;
      playNext();
    };
    
    currentSourceRef.current = source;
    source.start();
  };

  const stopSession = () => {
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {}
      sessionRef.current = null;
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    currentSourceRef.current = null;
    
    setIsConnected(false);
    setIsConnecting(false);
    setTranscript('Call ended.');
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <div className="bg-slate-900 rounded-2xl p-6 shadow-xl text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated background rings when connected */}
      {isConnected && (
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
          <div className="w-32 h-32 bg-emerald-500 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
          <div className="absolute w-48 h-48 bg-emerald-500 rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }}></div>
        </div>
      )}
      
      <div className="z-10 flex flex-col items-center w-full">
        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-700">
          {isConnecting ? (
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          ) : isConnected ? (
            <Volume2 className="w-8 h-8 text-emerald-400 animate-pulse" />
          ) : (
            <PhoneCall className="w-8 h-8 text-slate-400" />
          )}
        </div>
        
        <h3 className="text-xl font-bold mb-2">AI Voice Triage</h3>
        
        <div className="h-20 w-full max-w-sm bg-slate-800/50 rounded-lg p-3 mb-8 overflow-y-auto text-center border border-slate-700/50">
          <p className="text-sm text-slate-300 italic">
            {error ? (
              <span className="text-red-400">{error}</span>
            ) : transcript || "Press start to talk with the AI doctor..."}
          </p>
        </div>
        
        <div className="flex gap-4">
          {!isConnected && !isConnecting ? (
            <button 
              onClick={startSession}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full px-8 py-3 font-medium flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/20"
            >
              <Mic className="w-5 h-5" /> Start Call
            </button>
          ) : (
            <button 
              onClick={stopSession}
              className="bg-red-600 hover:bg-red-500 text-white rounded-full px-8 py-3 font-medium flex items-center gap-2 transition-colors shadow-lg shadow-red-900/20"
            >
              <PhoneOff className="w-5 h-5" /> End Call
            </button>
          )}
          
          <button 
            onClick={() => { stopSession(); onClose(); }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full px-6 py-3 font-medium transition-colors border border-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
