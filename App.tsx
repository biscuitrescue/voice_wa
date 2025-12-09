import React from 'react';
import VoiceAgent from './components/VoiceAgent';

const App: React.FC = () => {
  // Check for API Key at the top level to give helpful feedback
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border-l-4 border-red-500">
                  <h1 className="text-xl font-bold text-red-700 mb-2">Configuration Error</h1>
                  <p className="text-gray-600">API Key is missing. Please ensure <code>process.env.API_KEY</code> is correctly configured in your environment.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto font-sans">
      {/* Header for the demo app */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-700 rounded-lg flex items-center justify-center text-white shadow-md">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-800 leading-tight">Farmer Connect</h1>
                  <p className="text-xs text-slate-500 font-medium">Odisha State</p>
                </div>
            </div>
            <div className="text-xs text-slate-400 font-mono hidden sm:block">
                Gemini Live Enabled
            </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col items-center justify-start sm:justify-center p-6 w-full gap-8">
        
        {/* Intro Text / Context */}
        <div className="max-w-lg w-full text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Ask <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Kisan Sathi</span>
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Your AI-powered agricultural expert. Ask about oilseeds, weather, or pest control in your native language.
            </p>
        </div>

        {/* THE INTEGRATED AGENT COMPONENT */}
        <div className="w-full flex justify-center">
            <VoiceAgent />
        </div>
        
        {/* Helper Chips */}
        <div className="flex flex-wrap gap-2 justify-center max-w-md">
            {['Best fertilizer for Mustard?', 'Groundnut pest control', 'सरसों की बुनाई कब करें?', 'ସୂର୍ଯ୍ୟମୁଖୀ ଚାଷ ପାଇଁ ପାଣିପାଗ?'].map((q, i) => (
                <div key={i} className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-500 shadow-sm cursor-default hover:bg-slate-50 transition-colors">
                    "{q}"
                </div>
            ))}
        </div>

      </main>

      {/* Footer Info */}
      <footer className="p-4 text-center text-xs text-slate-400 bg-slate-50 border-t border-slate-200">
          Powered by Google Gemini 2.5 Flash • Native Audio Streaming
      </footer>
    </div>
  );
};

export default App;