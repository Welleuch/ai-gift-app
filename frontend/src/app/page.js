"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Send, Loader2, Box, Sparkles, Cpu, Layers, Download, CheckCircle2 } from 'lucide-react';
import PedestalControls from '../components/PedestalControls';

// --- CONFIGURATION ---
const API_BASE = "https://3d-gift-manager.walid-elleuch.workers.dev";

// Define runpodConfig BEFORE the component
const runpodConfig = {
  headers: {
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
  // ... existing code ...

  try {
    console.log('Sending request to Worker...');
    
    const chatRes = await axios.post(`${API_BASE}/runsync`, {
      input: {
        type: "CHAT",
        message: userMsg
      }
    }, runpodConfig);

    console.log('Worker response data:', chatRes.data);
    console.log('Worker output:', chatRes.data.output);

    const output = chatRes.data.output;

    if (output && output.visual_prompt) {
      console.log('Visual prompt:', output.visual_prompt);
      setMessages([...newHistory, { role: 'assistant', content: output.response }]);
      setStatus('Generating high-resolution design...');
      
      const genRes = await axios.post(`${API_BASE}/runsync`, {
        input: {
          type: "GEN_IMAGE",
          visual_prompt: output.visual_prompt
        }
      }, runpodConfig);

      console.log('Image generation full response:', genRes.data);
      console.log('Image generation output:', genRes.data.output);

      if (genRes.data.output && genRes.data.output.images) {
        console.log('Images array:', genRes.data.output.images);
        setGeneratedImages(genRes.data.output.images);
      } else {
        console.error('No images in response. Full response:', genRes.data);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "Image generation failed. Please try again." 
        }]);
      }
    } else {
      console.log('No visual prompt in response:', output);
      setMessages([...newHistory, { role: 'assistant', content: output?.response || "Hmm, let me think..." }]);
    }
  } catch (error) {
    console.error("Full error:", error);
    console.error("Error response:", error.response?.data);
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: "Error: " + (error.message || "Please try again.") 
    }]);
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

      console.log('3D generation response:', res.data);

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
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Design something unique..."
            />
            <button onClick={sendMessage} className="absolute right-2 top-2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors shadow-lg">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* MAIN WORKBENCH - Rest of your JSX remains the same */}
      {/* ... rest of your JSX code ... */}
    </div>
  );
}