"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Send, Loader2, Box, Sparkles, Cpu, Layers, Download, CheckCircle2, Settings } from 'lucide-react';
import PedestalControls from '../components/PedestalControls';

// --- CONFIGURATION ---
const API_BASE = "https://3d-gift-manager.walid-elleuch.workers.dev";
const RUNPOD_API_KEY = process.env.NEXT_PUBLIC_RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = "nefvw8vdxu2yd3";

const runpodConfig = {
  headers: {
    'Content-Type': 'application/json'
  }
};

// Import ModelViewer dynamically to avoid SSR issues with Three.js
const ModelViewer = dynamic(() => import('../components/ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-slate-100">
      <div className="text-slate-400 animate-pulse font-bold text-xs uppercase tracking-widest">
        Initializing 3D Engine...
      </div>
    </div>
  )
});

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Welcome to the AI 3D Gift Studio. Tell me about the recipient's hobbies to begin." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [modelUrl, setModelUrl] = useState(null);
  const [showPedestalUI, setShowPedestalUI] = useState(false);
  const [orderSummary, setOrderSummary] = useState(null);
  
  // STABLE INITIAL STATE
  const [pedestalSettings, setPedestalSettings] = useState({
    shape: 'box',
    height: 10,
    width: 60,
    depth: 60,
    text: '',
    offset: 10,
    scale: 1.0,
    modelZOffset: 0
  });

  const chatEndRef = useRef(null);
  const exporterRef = useRef();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setStatus('Analyzing ideas...');

    try {
      const chatRes = await axios.post(`${API_BASE}/chat`, {
        messages: [...messages, { role: 'user', content: userMsg }]
      });

      const assistantMsg = chatRes.data.content;
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMsg }]);

      if (assistantMsg.toLowerCase().includes('generating') || assistantMsg.toLowerCase().includes('3d model')) {
        await generate3DModel(userMsg);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const generate3DModel = async (prompt) => {
    setStatus('Generating 3D assets...');
    try {
      const response = await axios.post(
        `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`,
        { input: { prompt, mode: "preview" } },
        { headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` } }
      );

      const jobId = response.data.id;
      pollStatus(jobId);
    } catch (err) {
      console.error("RunPod Error:", err);
      setStatus("Generation failed.");
    }
  };

  const pollStatus = async (jobId) => {
    const check = async () => {
      const res = await axios.get(
        `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${jobId}`,
        { headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` } }
      );

      if (res.data.status === 'COMPLETED') {
        const url = res.data.output.model_url || res.data.output;
        setModelUrl(url);
        setStatus("Model ready!");
        setShowPedestalUI(true);
      } else if (res.data.status === 'FAILED') {
        setStatus("Generation failed.");
      } else {
        setTimeout(check, 3000);
      }
    };
    check();
  };

  const handleDownloadSTL = async () => {
    if (!exporterRef.current) return;
    setStatus("Preparing high-quality mesh...");
    
    try {
      const stlData = exporterRef.current.exportSTL();
      const blob = new Blob([stlData], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `3d-gift-${Date.now()}.stl`;
      link.click();
      
      // Simulate Order Summary Calculation
      setOrderSummary({
        print_time: "4h 12m",
        weight: "42g",
        price: "$18.50"
      });
      setStatus("Design ready for printing!");
    } catch (err) {
      console.error(err);
      setStatus("Export failed.");
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* LEFT: CHAT SIDEBAR */}
      <div className="w-[400px] flex flex-col bg-white border-r border-slate-200 shadow-xl z-20">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 p-2 rounded-xl">
              <Sparkles size={20} className="text-white" />
            </div>
            <h1 className="font-black tracking-tighter text-xl">GIFT STUDIO</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium shadow-sm ${
                m.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                <Loader2 className="animate-spin text-blue-600" size={16} />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{status}</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Describe your gift idea..."
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-6 pr-14 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-inner font-medium"
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="absolute right-2 p-3 bg-slate-900 text-white rounded-xl hover:bg-black transition-all disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: 3D VIEWPORT */}
      <div className="flex-1 relative bg-slate-100 z-0">
        {/* Important: z-10 and pointer-events-auto makes OrbitControls work */}
        <div className="absolute inset-0 z-10 pointer-events-auto">
          {modelUrl ? (
            <ModelViewer 
              url={modelUrl} 
              pedestalSettings={pedestalSettings} 
              setSettings={setPedestalSettings}
              exporterRef={exporterRef} 
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl animate-bounce">
                <Box size={40} className="text-blue-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">3D Workspace Empty</h2>
              <p className="max-w-xs text-sm font-bold text-slate-400 uppercase tracking-tighter">
                Chat with the AI to generate a custom 3D model
              </p>
            </div>
          )}
        </div>

        {/* TOP STATUS BAR */}
        <div className="absolute top-8 left-8 right-8 flex justify-between items-center pointer-events-none z-30">
          <div className="flex gap-2">
            {['Engine Active', 'Auto-Scale ON', 'Lighting Studio'].map((tag) => (
              <div key={tag} className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-white shadow-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{tag}</span>
              </div>
            ))}
          </div>
          
          {modelUrl && (
            <button 
              onClick={() => setShowPedestalUI(!showPedestalUI)}
              className="pointer-events-auto bg-white p-3 rounded-2xl shadow-xl border border-slate-100 hover:bg-slate-50 transition-all text-slate-700"
            >
              <Settings size={20} />
            </button>
          )}
        </div>

        {/* PEDESTAL CONTROLS */}
        {showPedestalUI && (
          <div className="z-50 relative">
             <PedestalControls 
                settings={pedestalSettings} 
                setSettings={setPedestalSettings} 
                onPrepare={() => setShowPedestalUI(false)} 
             />
          </div>
        )}

        {/* BOTTOM ACTION BAR */}
        <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end pointer-events-none z-30">
          <div className="pointer-events-auto">
            {orderSummary && (
              <div className="bg-white/90 backdrop-blur-md p-6 rounded-[32px] shadow-2xl border border-white flex flex-col gap-1">
                <span className="text-[10px] font-black text-blue-600 uppercase">Estimated Specs</span>
                <div className="text-sm font-bold text-slate-800">
                  Time: <span className="text-slate-500">{orderSummary.print_time}</span> • 
                  Price: <span className="text-green-600">{orderSummary.price}</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 pointer-events-auto">
            {modelUrl && (
              <button
                onClick={handleDownloadSTL}
                className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-sm font-black hover:bg-black transition-all flex items-center gap-3 shadow-2xl group"
              >
                <Download size={20} className="group-hover:translate-y-0.5 transition-transform" />
                DOWNLOAD STL
              </button>
            )}
          </div>
        </div>
      </div>

      {status && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-white px-6 py-3 rounded-2xl shadow-2xl border border-blue-100 z-[60] flex items-center gap-3">
          <CheckCircle2 size={18} className="text-blue-500" />
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{status}</span>
        </div>
      )}
    </div>
  );
}