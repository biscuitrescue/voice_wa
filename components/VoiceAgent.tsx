import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionStatus } from '../types';
import { MODEL_NAME, SYSTEM_INSTRUCTION } from '../constants';
import { createPcmBlob, decodeAudio, decodeAudioData, createSilentAudio } from '../utils/audioUtils';
import Visualizer from './Visualizer';

type AgentMode = 'inactive' | 'ready' | 'listening' | 'thinking' | 'speaking';

const VoiceAgent: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [mode, setMode] = useState<AgentMode>('inactive');
  const [error, setError] = useState<string | null>(null);
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  
  // Refs for audio handling
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Ref for tracking mode inside callbacks
  const modeRef = useRef<AgentMode>('inactive');

  const apiKey = process.env.API_KEY;

  // Update refs when state changes
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    
    sessionPromiseRef.current?.then(session => {
        // @ts-ignore
        if(session.close) session.close();
    }).catch(() => {});
    sessionPromiseRef.current = null;

    setStatus(ConnectionStatus.DISCONNECTED);
    setMode('inactive');
    setCurrentVolume(0);
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const connect = async () => {
    if (!apiKey) {
      setError("API Key missing");
      return;
    }

    try {
      setStatus(ConnectionStatus.CONNECTING);
      setMode('inactive');
      setError(null);

      // 1. Setup Audio Input
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      const inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioContextRef.current = inputContext;

      const source = inputContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      
      const processor = inputContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // 2. Setup Audio Output
      const outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputAudioContextRef.current = outputContext;
      
      const gainNode = outputContext.createGain();
      gainNode.gain.value = 1.0; 
      gainNode.connect(outputContext.destination);
      gainNodeRef.current = gainNode;

      // 3. Connect to Gemini
      const ai = new GoogleGenAI({ apiKey });
      
      sessionPromiseRef.current = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connected');
            setStatus(ConnectionStatus.CONNECTED);
            setMode('ready');
            
            processor.onaudioprocess = (e) => {
              // Only send audio when listening
              if (modeRef.current !== 'listening') {
                  setCurrentVolume(0);
                  return;
              }

              const inputData = e.inputBuffer.getChannelData(0);
              
              // Calculate volume for visualizer
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setCurrentVolume(Math.min(1, rms * 5));

              const pcmBlob = createPcmBlob(inputData);
              sessionPromiseRef.current?.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setMode('speaking');
              
              nextStartTimeRef.current = Math.max(
                nextStartTimeRef.current,
                outputContext.currentTime
              );

              const audioBuffer = await decodeAudioData(
                decodeAudio(base64Audio),
                outputContext,
                24000,
                1
              );

              const bufferSource = outputContext.createBufferSource();
              bufferSource.buffer = audioBuffer;
              bufferSource.connect(gainNode);
              
              bufferSource.addEventListener('ended', () => {
                 sourcesRef.current.delete(bufferSource);
                 if (sourcesRef.current.size === 0) {
                     setTimeout(() => {
                        // Only return to ready if we haven't started listening again
                        if (sourcesRef.current.size === 0 && modeRef.current === 'speaking') {
                            setMode('ready');
                        }
                     }, 200);
                 }
              });

              bufferSource.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(bufferSource);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setMode('ready'); // Reset to ready if interrupted
            }
          },
          onclose: () => {
            console.log('Session closed');
            cleanup();
          },
          onerror: (err) => {
            console.error(err);
            setError("Connection lost");
            cleanup();
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } 
            },
            systemInstruction: {
                parts: [{ text: SYSTEM_INSTRUCTION }]
            }
        }
      });

    } catch (err: any) {
      console.error(err);
      setError("Failed to connect");
      cleanup();
    }
  };

  const toggleMic = async () => {
    if (status !== ConnectionStatus.CONNECTED) return;

    if (mode === 'listening') {
        // STOP LISTENING -> START THINKING
        setMode('thinking');
        
        // Send silence to force End-of-Turn
        await sendSilence();
    } else {
        // START LISTENING
        // Stop any current AI speech
        sourcesRef.current.forEach(s => s.stop());
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        
        // Resume context if needed
        if (inputAudioContextRef.current?.state === 'suspended') {
            await inputAudioContextRef.current.resume();
        }
        
        setMode('listening');
    }
  };

  const sendSilence = async () => {
      // Send ~500ms of silence to trigger VAD
      const silenceBlob = createSilentAudio(16000, 0.5); 
      const session = await sessionPromiseRef.current;
      if (session) {
          session.sendRealtimeInput({ media: silenceBlob });
      }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
      <div className="bg-slate-50 p-6 border-b border-slate-100 flex flex-col items-center text-center relative">
        {status === ConnectionStatus.CONNECTED && (
             <button 
                onClick={cleanup}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Disconnect"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
             </button>
        )}

        <h2 className="text-xl font-bold text-slate-800">Kisan Sathi</h2>
        <p className="text-sm text-slate-500">Multilingual Oilseeds Advisor</p>
        
        <div className={`mt-3 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors duration-300 ${
            status === ConnectionStatus.CONNECTED 
              ? 'bg-green-100 text-green-700'
              : status === ConnectionStatus.CONNECTING
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-600'
          }`}>
             <div className={`w-2 h-2 rounded-full ${
                status === ConnectionStatus.CONNECTED ? 'bg-green-500' : 
                status === ConnectionStatus.CONNECTING ? 'bg-amber-500 animate-bounce' : 'bg-slate-400'
             }`} />
             {status === ConnectionStatus.CONNECTED ? 'Live Session Active' : status === ConnectionStatus.CONNECTING ? 'Connecting...' : 'Ready to Start'}
        </div>
      </div>

      <div className="p-6 flex flex-col items-center gap-6">
        {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs w-full text-center border border-red-200">
                {error}
            </div>
        )}

        <div className="w-full relative">
            {status === ConnectionStatus.CONNECTED && (
                 <div className="absolute -top-8 left-0 w-full text-center">
                    <span className={`text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                        mode === 'speaking' ? 'text-green-600' : 
                        mode === 'listening' ? 'text-red-500' : 
                        mode === 'thinking' ? 'text-amber-500 animate-pulse' :
                        'text-slate-400'
                    }`}>
                        {mode === 'speaking' ? 'Speaking...' : 
                         mode === 'listening' ? 'Listening...' : 
                         mode === 'thinking' ? 'Thinking...' :
                         'Tap Mic to Speak'}
                    </span>
                 </div>
            )}
            <Visualizer 
                isActive={status === ConnectionStatus.CONNECTED} 
                volume={mode === 'speaking' ? 0.6 : (mode === 'listening' ? currentVolume : 0)} 
                mode={mode}
            />
        </div>

        {status === ConnectionStatus.CONNECTED ? (
            <button
                onClick={toggleMic}
                disabled={mode === 'thinking'}
                className={`
                    relative flex items-center justify-center w-20 h-20 rounded-full shadow-lg transition-all duration-200 
                    ${mode === 'thinking' ? 'cursor-wait opacity-80 scale-95' : 'hover:scale-105 active:scale-95'}
                    ${mode === 'listening' 
                        ? 'bg-red-500 hover:bg-red-600 shadow-red-200 ring-4 ring-red-100' 
                        : mode === 'thinking'
                        ? 'bg-amber-500 shadow-amber-200'
                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                    }
                `}
            >
                {mode === 'listening' ? (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-8 h-8 animate-pulse">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
                     </svg>
                ) : mode === 'thinking' ? (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-8 h-8 animate-spin">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                     </svg>
                ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-8 h-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                     </svg>
                )}
            </button>
        ) : (
            <button
                onClick={connect}
                disabled={status === ConnectionStatus.CONNECTING}
                className="
                    relative flex items-center justify-center px-8 py-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95
                    bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 text-white font-semibold text-lg gap-2
                    disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none
                "
            >
                {status === ConnectionStatus.CONNECTING ? (
                    <span>Connecting...</span>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
                        </svg>
                        <span>Start Conversation</span>
                    </>
                )}
            </button>
        )}

        <p className="text-xs text-slate-400 text-center max-w-[240px]">
            {status === ConnectionStatus.CONNECTED 
             ? (mode === 'listening' ? "Tap to stop & send" : mode === 'thinking' ? "One moment..." : "Tap mic to speak") 
             : "Start the session to talk to Kisan Sathi"}
        </p>
      </div>
    </div>
  );
};

export default VoiceAgent;