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

// --- NEW: INDEPENDENT POLLING LOGIC ---
  const generateAndAddCard = async (idea) => {
    try {
      // 1. Submit async job to RunPod
      const runRes = await axios.post(
        `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`,
        { input: { visual_prompt: idea.visual } },
        { headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` } }
      );
      const jobId = runRes.data.id;

      let imageUrl = null;
      let attempts = 0;
      const maxAttempts = 60; // 3 minutes total

      // 2. Poll until COMPLETED or FAILED
      while (!imageUrl && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 4000)); // Poll every 4 seconds
        
        const statusRes = await axios.get(
          `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${jobId}`,
          { headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` } }
        );
        
        if (statusRes.data.status === "COMPLETED") {
          imageUrl = statusRes.data.output.image_url;
        } else if (statusRes.data.status === "FAILED") {
          throw new Error("RunPod job failed");
        }
        attempts++;
      }

      // 3. PHASE 4: Only create the card when the image is 100% ready
      if (imageUrl) {
        setGeneratedImages(prev => [...prev, {
          name: idea.name,
          url: imageUrl
        }]);
      }
    } catch (err) {
      console.error(`Generation failed for ${idea.name}:`, err);
    }
  };


  // 1. CHAT & IMAGE GENERATION FLOW
const sendMessage = async () => {
  if (!input || loading) return;
  const userMessage = input;
  const newHistory = [...messages, { role: 'user', content: userMessage }];
  
  setMessages(newHistory);
  setInput('');
  setLoading(true);
  setStatus('Brainstorming ideas...'); 
  setGeneratedImages([]); 

  try {
    // STEP 1: Get only the names/descriptions from Llama
    const res = await axios.post(`${API_BASE}`, {
        type: "CHAT",
        message: userMessage
    }, runpodConfig);

    const result = res.data;

    if (result.status === 'success' && result.ideas) {
      setMessages([...newHistory, { 
        role: 'assistant', 
        content: `I've got 3 ideas! Generating the 3D previews now...` 
      }]);
      
      // STEP 2: Create "Loading" placeholders immediately
      // This makes the 3 boxes appear on screen at once, but empty/loading
      const placeholders = result.ideas.map((idea, index) => ({
        ...idea,
        url: null, // No image yet
        isLoading: true,
        id: index
      }));
      setGeneratedImages(placeholders);
      setLoading(false); // Stop the main sidebar loader
      setStatus('Generating 3D previews...');

      // STEP 3: Request each image INDIVIDUALLY in parallel
      result.ideas.forEach(async (idea, index) => {
        try {
          const imgRes = await axios.post(`${API_BASE}`, {
            type: "GEN_IMAGE", // New case in your worker
            visual: idea.visual,
            name: idea.name,
            index: index
          }, runpodConfig);

          // STEP 4: Update ONLY this specific image in the state
          setGeneratedImages(prev => 
            prev.map((item, i) => i === index ? { ...imgRes.data, isLoading: false } : item)
          );
        } catch (err) {
          console.error(`Failed to load image ${index}`, err);
        }
      });
    }
  } catch (error) {
    console.error("Worker Error:", error);
    setLoading(false);
  }
};

// 2. 3D RECONSTRUCTION FLOW - FIXED VERSION
const handleSelectImage = async (imgUrl) => {
  setModelUrl(null);
  setShowPedestalUI(false);
  setLoading(true);
  setStatus('Generating 3D Geometry... (this takes 1-2 minutes)');
  setGeneratedImages([]);

  console.log('Generating 3D model from image:', imgUrl);
  
  try {
    // Call the Worker root directly to trigger the Local Tunnel
    const res = await axios.post(`${API_BASE}`, {
        type: "GEN_3D", 
        image_url: imgUrl
    }, runpodConfig);

    // Use the clean, flat data structure from your Worker
    const result = res.data; 

    if (result.status === 'success' && result.mesh_url) {
      console.log('3D Model Success:', result.mesh_url);
      setModelUrl(result.mesh_url);
      setStatus('3D model ready! Click "Print Settings" to customize.');
      
      // Auto-show pedestal UI after a short delay
      setTimeout(() => {
        setShowPedestalUI(true);
      }, 1500);
    } else {
      throw new Error(result.message || 'No mesh URL found in response');
    }

  } catch (e) {
    console.error("3D Generation Error:", e);
    setStatus('3D Generation Failed');
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: "3D generation error: " + (e.message || 'Check local handler console')
    }]);
  }
  setLoading(false);
};

  // 3. SLICING & PRICE FLOW (same as before)
  const handlePrepareGCode = async () => {
    if (!exporterRef.current) return;
    setStatus('Preparing Manufacturing Data...');
    setLoading(true);

    try {
      // Step A: Export STL from browser
      const stlData = exporterRef.current.exportSTL();

      // Step B: Convert Blob to Base64
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
              <div className={`p-4 rounded-[24px] max-w-[85%] text-sm leading-relaxed shadow-sm font-medium ${m.role === 'user' ? 'bg-blue-600 text-white shadow-blue-900/20' : 'bg-slate-800 text-slate-200 border border-slate-700'
                }`}>{m.content}</div>
            </div>
          ))}
          {loading && (
            <div className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse flex items-center gap-3 px-2">
              <Loader2 className="animate-spin" size={14} /> {status}
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
            <button
              onClick={sendMessage}
              disabled={loading}
              className="absolute right-2 top-2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* MAIN WORKBENCH */}
      <div className="flex-1 relative">
        {/* 3D VIEWER */}
        <div className="absolute inset-0">
  {modelUrl ? (
    <ModelViewer 
      url={modelUrl} 
      pedestalSettings={pedestalSettings} 
      exporterRef={exporterRef} 
    />
  ) : loading && status.includes('3D') ? (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-100 to-slate-100 rounded-3xl flex items-center justify-center shadow-xl animate-pulse">
          <Layers className="text-blue-400" size={40} />
        </div>
        <div>
          <h3 className="font-black text-slate-800 text-lg">Generating 3D Model</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mt-2">
            {status}
          </p>
          <p className="text-slate-400 text-xs mt-4">
            This may take 1-2 minutes...
          </p>
        </div>
      </div>
    </div>
  ) : (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-100 to-slate-100 rounded-3xl flex items-center justify-center shadow-xl">
          <Box className="text-blue-400" size={40} />
        </div>
        <div>
          <h3 className="font-black text-slate-800 text-lg">Ready for 3D Creation</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mt-2">
            Describe your gift idea and I'll generate custom 3D designs for you
          </p>
        </div>
      </div>
    </div>
  )}
</div>

{/* IMAGE GALLERY SECTION */}
      {generatedImages.length > 0 && (
        <div className="absolute bottom-8 left-8 right-8 bg-white/90 backdrop-blur-sm rounded-[32px] p-6 border border-white/50 shadow-2xl z-30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Generated Designs</h3>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {generatedImages.length} design{generatedImages.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {generatedImages.map((idea, idx) => (
              <div
                key={idx}
                className="relative group cursor-pointer rounded-2xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all duration-300 bg-slate-100 shadow-sm"
                onClick={() => !idea.isLoading && handleSelectImage(idea.url)}
              >
                <div className="relative w-full h-48 overflow-hidden">
                  {idea.isLoading ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 animate-pulse">
                      <Loader2 className="animate-spin text-blue-500 mb-2" size={24} />
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Baking Image...</span>
                    </div>
                  ) : (
                    <img
                      src={idea.url}
                      alt={idea.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `
                          <div class="w-full h-full flex flex-col items-center justify-center bg-slate-200 p-4">
                            <div class="text-slate-700 text-sm font-bold text-center">Failed</div>
                          </div>
                        `;
                      }}
                    />
                  )}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">
                    {idea.name}
                  </p>
                  <p className="text-white text-xs font-bold">
                    {idea.isLoading ? "Generating..." : "Click to generate 3D"}
                  </p>
                </div>

                <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] font-black px-2 py-1 rounded-full">
                  {idx + 1}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs text-slate-500 font-medium">
              Select a design to begin the 3D conversion process
            </p>
          </div>
        </div>
      )}

      {/* CONTROL BAR */}
      <div className="absolute top-8 left-8 right-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPedestalUI(!showPedestalUI)}
            className="glass-card px-6 py-3 rounded-2xl text-sm font-bold hover:bg-white/20 transition-all bg-white/50 border border-white"
          >
            <Settings size={18} className="inline mr-2 text-slate-700" />
            Print Settings
          </button>
          {orderSummary && (
            <div className="glass-card px-6 py-3 rounded-2xl bg-white/50 border border-white">
              <div className="text-sm font-bold text-slate-800">
                Est. Print: <span className="text-green-600">{orderSummary.print_time}</span> • 
                Weight: <span className="text-blue-600">{orderSummary.weight}</span> • 
                Price: <span className="text-purple-600">{orderSummary.price}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {modelUrl && (
            <button
              onClick={handlePrepareGCode}
              className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-black transition-all flex items-center gap-2 shadow-xl"
            >
              <Download size={18} />
              Order Print
            </button>
          )}
        </div>
      </div>

      {status && !loading && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-lg border border-white/50 z-50">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <CheckCircle2 size={16} className="text-green-500" />
            {status}
          </div>
        </div>
      )}
    </div>

    {showPedestalUI && (
      <PedestalControls 
        settings={pedestalSettings} 
        setSettings={setPedestalSettings}
        onPrepare={() => setShowPedestalUI(false)}
      />
    )}
  </div>
  );
}