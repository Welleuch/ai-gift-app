"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Send, Loader2, Box, Sparkles, Cpu, Layers, Download, CheckCircle2 } from 'lucide-react';
import PedestalControls from '../components/PedestalControls';

// --- CONFIGURATION ---
// NEXT_PUBLIC_API_URL should be: https://api.runpod.ai/v2/tdruhtxrmqrksm
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

const runpodConfig = {
  headers: {
    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_RUNPOD_KEY}`,
    'Content-Type': 'application/json'
  }
};

const ModelViewer = dynamic(() => import('../components/ModelViewer'), { 
  ssr: false,
  loading: () => <div className="text-slate-400 animate-pulse font-bold text-xs uppercase tracking-widest">Initializing 3D Engine...</div>
});

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Welcome to the AI 3D Gift Studio. Tell me about the recipient's hobbies to begin." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [generatedImages, setGeneratedImages] = useState([]);
  const [modelUrl, setModelUrl] = useState(null);
  
  const exporterRef = useRef(null);
  const [showPedestalUI, setShowPedestalUI] = useState(false);
  const [orderSummary, setOrderSummary] = useState(null);
  const [isOrdered, setIsOrdered] = useState(false);

  const [pedestalSettings, setPedestalSettings] = useState({
    shape: 'box', height: 10, width: 60, depth: 60, text: '', offset: 0, scale: 1.0
  });

  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // 1. CHAT & IMAGE GENERATION FLOW
  const sendMessage = async () => {
    if (!input || loading) return;
    const userMsg = input;
    const newHistory = [...messages, { role: 'user', content: userMsg }];
    setMessages(newHistory);
    setInput('');
    setLoading(true);
    setStatus('AI is thinking...');

    try {
      // Step A: Call the Serverless Manager for Chat
      const chatRes = await axios.post(`${API_BASE}/runsync`, {
        input: {
          type: "CHAT",
          message: userMsg
        }
      }, runpodConfig);

      const output = chatRes.data.output;

      if (output && output.visual_prompt) {
        setMessages([...newHistory, { role: 'assistant', content: output.response }]);
        setStatus('Generating high-resolution design...');
        
        // Step B: Call the Serverless Manager for Image Generation
        const genRes = await axios.post(`${API_BASE}/runsync`, {
          input: {
            type: "GEN_IMAGE",
            visual_prompt: output.visual_prompt
          }
        }, runpodConfig);

        // Result from ComfyUI worker
        if (genRes.data.output && genRes.data.output.images) {
          setGeneratedImages(genRes.data.output.images);
        }
      } else {
        setMessages([...newHistory, { role: 'assistant', content: output.response || "I'm not sure how to design that. Can you tell me more?" }]);
      }
    } catch (error) {
      console.error("RunPod Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Connection Error. Ensure RunPod Endpoint is active." }]);
    }
    setLoading(false);
  };

  // 2. 3D RECONSTRUCTION FLOW
  const handleSelectImage = async (imgUrl) => {
    setModelUrl(null);
    setShowPedestalUI(false);
    setLoading(true);
    setStatus('Generating 3D Geometry (RTX 3090)...');
    setGeneratedImages([]);

    try {
      const res = await axios.post(`${API_BASE}/runsync`, {
        input: {
          type: "GEN_3D",
          image_url: imgUrl
        }
      }, runpodConfig);

      if (res.data.output && res.data.output.images) {
        // Find the GLB file in the returned list
        const glb = res.data.output.images.find(url => url.toLowerCase().endsWith('.glb'));
        if (glb) setModelUrl(glb);
      }
    } catch (e) {
      console.error(e);
      setStatus('3D Generation Failed');
    }
    setLoading(false);
  };

  // 3. SLICING & PRICE FLOW
  const handlePrepareGCode = async () => {
    if (!exporterRef.current) return;
    setStatus('Preparing Manufacturing Data...');
    setLoading(true);

    try {
      // Step A: Export STL from browser
      const stlData = exporterRef.current.exportSTL();
      
      // Step B: Convert Blob to Base64 (Standard for Serverless JSON)
      const blob = new Blob([stlData], { type: 'application/octet-stream' });
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      reader.onloadend = async () => {
        const base64data = reader.result.split(',')[1];

        // Step C: Send to Serverless Manager
        const res = await axios.post(`${API_BASE}/runsync`, {
          input: {
            type: "SLICE",
            stl_data: base64data
          }
        }, runpodConfig);

        if (res.data.output && res.data.output.status === 'success') {
          setOrderSummary(res.data.output);
          setStatus('Ready');
        } else {
          alert("Slicing Error: " + (res.data.output?.message || "Unknown error"));
        }
        setLoading(false);
      };
    } catch (e) {
      console.error(e);
      setStatus('Slicing failed');
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden tracking-tight">
      {/* SIDEBAR */}
      <div className="w-[400px] bg-slate-900 flex flex-col z-20 shadow-2xl">
        <div className="p-8 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-blue-500 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-500/20"><Sparkles size={20} /></div>
          <h1 className="text-white font-black text-xl tracking-tighter">GiftAI Studio</h1>
        </div>
        
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
              <div className={`p-4 rounded-[24px] max-w-[85%] text-sm leading-relaxed shadow-sm font-medium ${
                m.role === 'user' ? 'bg-blue-600 text-white shadow-blue-900/20' : 'bg-slate-800 text-slate-200 border border-slate-700'
              }`}>{m.content}</div>
            </div>
          ))}
          {loading && (
            <div className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse flex items-center gap-3 px-2">
              <Loader2 className="animate-spin" size={14}/> {status}
            </div>
          )}
        </div>
        
        <div className="p-6 bg-slate-900 border-t border-slate-800">
          <div className="relative">
            <input 
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 pl-5 pr-14 text-white text-sm focus:ring-4 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-500 font-bold"
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} 
              placeholder="Design something unique..."
            />
            <button onClick={sendMessage} className="absolute right-2 top-2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors shadow-lg"><Send size={18} /></button>
          </div>
        </div>
      </div>

      {/* MAIN WORKBENCH */}
      <div className="flex-1 relative flex flex-col bg-[#fdfdfe]">
        <div className="absolute top-8 left-8 flex gap-4 z-10 font-black">
          <div className="bg-white/80 backdrop-blur px-5 py-2.5 rounded-full flex items-center gap-2 text-[10px] text-slate-600 shadow-xl border border-white"><Cpu size={14} className="text-blue-500" /> SERVERLESS: ACTIVE</div>
          <div className="bg-white/80 backdrop-blur px-5 py-2.5 rounded-full flex items-center gap-2 text-[10px] text-slate-600 shadow-xl border border-white"><Layers size={14} className="text-green-500" /> DfAM: ENFORCED</div>
        </div>

        {showPedestalUI && <PedestalControls settings={pedestalSettings} setSettings={setPedestalSettings} onPrepare={() => setShowPedestalUI(false)} />}
        
        <main className="flex-1 p-16 flex items-center justify-center">
          {!modelUrl && generatedImages.length === 0 && !loading && (
            <div className="text-center opacity-10 select-none">
              <Box size={120} className="mx-auto mb-6" />
              <h2 className="font-black uppercase tracking-[0.5em] text-lg">Factory Offline</h2>
            </div>
          )}

          {!modelUrl && generatedImages.length > 0 && (
            <div className="grid grid-cols-2 gap-12 w-full max-w-5xl animate-in zoom-in-95 duration-500">
              {generatedImages.map((img, i) => (
                <div key={i} onClick={() => handleSelectImage(img)} className="group relative cursor-pointer rounded-[50px] overflow-hidden shadow-2xl border-[10px] border-white hover:scale-105 transition-all bg-white shadow-slate-200">
                  <img src={img} alt="Design" className="w-full h-[450px] object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                    <div className="bg-white text-blue-600 px-10 py-4 rounded-3xl font-black shadow-2xl text-sm uppercase tracking-tighter">Build 3D Figurine</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {modelUrl && (
            <div className="w-full h-full flex flex-col relative animate-in fade-in duration-1000">
              <div className="flex-1 bg-white rounded-[60px] shadow-2xl overflow-hidden border-[16px] border-white ring-1 ring-slate-100 relative shadow-slate-300/50">
                <ModelViewer url={modelUrl} pedestalSettings={pedestalSettings} exporterRef={exporterRef} />
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-5">
                  <button onClick={() => setShowPedestalUI(!showPedestalUI)} className={`px-10 py-5 rounded-[24px] shadow-2xl font-black text-xs uppercase tracking-widest transition-all ${showPedestalUI ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-900 text-white hover:bg-black'}`}>
                    {showPedestalUI ? 'Close Editor' : 'Customize Base'}
                  </button>
                  <button onClick={handlePrepareGCode} className="bg-blue-600 text-white px-10 py-5 rounded-[24px] shadow-2xl shadow-blue-200 hover:bg-blue-700 font-black text-xs uppercase tracking-widest transition-transform hover:-translate-y-1 active:scale-95">
                    Prepare G-Code
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ORDER SUMMARY OVERLAY */}
        {orderSummary && !isOrdered && (
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
            <div className="bg-white rounded-[50px] w-full max-w-md p-12 shadow-2xl">
              <h2 className="text-4xl font-black text-center mb-2 tracking-tighter">Checkout</h2>
              <p className="text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-10">Production Quote</p>
              <div className="space-y-4 mb-10">
                <div className="flex justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100">
                   <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Time</span>
                   <span className="font-black text-slate-800">{orderSummary.print_time}</span>
                </div>
                <div className="flex justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100">
                   <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Material</span>
                   <span className="font-black text-slate-800">{orderSummary.weight}g</span>
                </div>
                <div className="flex justify-between items-end pt-8 px-2">
                   <span className="font-black text-2xl tracking-tighter">Total Price</span>
                   <span className="text-4xl font-black text-blue-600 tracking-tighter">{orderSummary.price}€</span>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <button onClick={() => setIsOrdered(true)} className="w-full bg-blue-600 text-white py-6 rounded-[28px] font-black text-lg shadow-2xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95">PAY & SHIP 🚀</button>
                <button onClick={() => setOrderSummary(null)} className="w-full font-bold text-slate-400 py-2 text-sm uppercase tracking-widest">Cancel Order</button>
              </div>
            </div>
          </div>
        )}

        {isOrdered && (
          <div className="absolute inset-0 bg-white z-[110] flex items-center justify-center text-center animate-in slide-in-from-bottom-20 duration-1000">
            <div className="max-w-md p-12">
              <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-green-200">
                <CheckCircle2 size={48} />
              </div>
              <h2 className="text-5xl font-black mb-6 tracking-tighter">Success!</h2>
              <p className="text-slate-500 mb-10 font-bold leading-relaxed text-lg">Your design has been queued for production at the closest 3D printing hub.</p>
              <button onClick={() => window.location.reload()} className="bg-slate-900 text-white px-12 py-5 rounded-[24px] font-black shadow-xl hover:bg-black transition-all">START NEW GIFT</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}