"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Send, Loader2, Box, Sparkles, Cpu, Layers, Download, CheckCircle2, Settings } from 'lucide-react';
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
    if (!input || loading) return;

    // Store the input value in a local variable BEFORE clearing it
    const userMessage = input; // <-- FIX: Store in local variable

    const newHistory = [...messages, { role: 'user', content: userMessage }];
    setMessages(newHistory);
    setInput(''); // Clear input AFTER storing
    setLoading(true);
    setStatus('AI is thinking...');

    try {
      console.log('Sending request to Worker...');

      // Step A: Call the Serverless Manager for Chat
      const chatRes = await axios.post(`${API_BASE}/runsync`, {
        input: {
          type: "CHAT",
          message: userMessage // <-- Use the local variable
        }
      }, runpodConfig);

      console.log('Worker response:', chatRes.data);
const output = chatRes.data.output;

console.log('=== DEBUG VISUAL PROMPTS ===');
console.log('Output object:', output);
console.log('visual_prompts:', output?.visual_prompts);
console.log('visual_prompt (old):', output?.visual_prompt);
console.log('all_ideas:', output?.all_ideas);
console.log('=== END DEBUG ===');

if ((!output.visual_prompts || output.visual_prompts.length === 0) && output.all_ideas) {
  console.log('Extracting visual prompts from all_ideas');
  output.visual_prompts = output.all_ideas.map(idea => idea.visual).filter(v => v && v.trim() !== '');
  console.log('Extracted visual_prompts:', output.visual_prompts);
}


if (output && output.visual_prompts && output.visual_prompts.length > 0) {
  setMessages([...newHistory, { role: 'assistant', content: output.response }]);
  setStatus(`Generating ${output.visual_prompts.length} high-resolution designs...`);

  // Step B: Call the Serverless Manager for Image Generation
  const genRes = await axios.post(`${API_BASE}/runsync`, {
    input: {
      type: "GEN_IMAGE",
      visual_prompts: output.visual_prompts // Send ALL visual prompts
    }
  }, runpodConfig);

  console.log('Image generation response:', genRes.data);

  // Debug: Log the entire response structure
  console.log('Full response structure:', JSON.stringify(genRes.data, null, 2));

  // Result from Worker
  if (genRes.data.output) {
    const result = genRes.data.output;

    if (result.images && Array.isArray(result.images) && result.images.length > 0) {
      console.log('Setting generated images:', result.images);
      setGeneratedImages(result.images);

      // Update the message to show we have images
      setMessages(prev => {
        const newMessages = [...prev];
        // Update the last message to include image count
        if (newMessages.length > 0) {
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = `I've created ${result.images.length} design${result.images.length > 1 ? 's' : ''} for you. Check them out below!`;
          }
        }
        return newMessages;
      });

      setStatus('Designs generated!');

      // Add a message about clicking to generate 3D
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "Click on any design to generate a 3D model!" 
        }]);
      }, 500);

    } else {
      console.error('No images in response:', result);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Generated ideas but couldn't create visual previews." 
      }]);
      setStatus('No images generated');
    }
  } else {
    console.error('No output in response:', genRes.data);
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: "Image generation failed. Please try again." 
    }]);
    setStatus('Generation failed');
  }
} else {
  setMessages([...newHistory, {
    role: 'assistant',
    content: output?.response || "Let me think about that..."
  }]);
}

 catch (error) {
      console.error("Worker Error:", error);
      console.error("Error details:", error.response?.data);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Oops, something went wrong. Please try again!"
      }]);
      setStatus('Error occurred');
    }
    setLoading(false);
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
    const res = await axios.post(`${API_BASE}/runsync`, {
      input: {
        type: "GEN_3D",
        image_url: imgUrl
      }
    }, runpodConfig);

    console.log('3D generation full response:', JSON.stringify(res.data, null, 2));

    if (res.data.output) {
      const result = res.data.output;
      console.log('3D generation result:', result);
      
      // Check for mesh URL in various formats
      let meshUrl = null;
      
      if (result.mesh_url) {
        // Format 1: Direct mesh_url
        meshUrl = result.mesh_url;
        console.log('Found mesh_url:', meshUrl);
      } 
      else if (result.status === 'success' && result.mesh_url) {
        // Format 2: In status success
        meshUrl = result.mesh_url;
        console.log('Found mesh_url in success:', meshUrl);
      }
      else if (result.local_path && result.local_path.endsWith('.glb')) {
        // Format 3: Local path
        meshUrl = result.local_path;
        console.log('Found local_path:', meshUrl);
      }
      else if (result.images && Array.isArray(result.images)) {
        // Format 4: Look for GLB in images array
        const glb = result.images.find(url => 
          typeof url === 'string' && url.toLowerCase().endsWith('.glb')
        );
        if (glb) {
          meshUrl = glb;
          console.log('Found GLB in images array:', meshUrl);
        }
      }
      
      if (meshUrl) {
        console.log('Setting model URL:', meshUrl);
        setModelUrl(meshUrl);
        setStatus('3D model ready! Click "Print Settings" to customize.');
        
        // Auto-show pedestal UI after a delay
        setTimeout(() => {
          setShowPedestalUI(true);
        }, 1500);
        
      } else {
        console.error('No GLB model found in response. Full response:', result);
        
        // Try to extract any URL that might be a mesh
        const allUrls = [];
        const extractUrls = (obj) => {
          if (typeof obj === 'string' && obj.includes('http')) {
            allUrls.push(obj);
          } else if (Array.isArray(obj)) {
            obj.forEach(item => extractUrls(item));
          } else if (typeof obj === 'object' && obj !== null) {
            Object.values(obj).forEach(value => extractUrls(value));
          }
        };
        extractUrls(result);
        
        const possibleMeshUrls = allUrls.filter(url => 
          url.toLowerCase().endsWith('.glb') || 
          url.includes('models/') || 
          url.includes('ComfyUI')
        );
        
        if (possibleMeshUrls.length > 0) {
          console.log('Found possible mesh URLs:', possibleMeshUrls);
          setModelUrl(possibleMeshUrls[0]);
          setStatus('3D model found! Loading...');
          setTimeout(() => {
            setShowPedestalUI(true);
          }, 1500);
        } else {
          setStatus('No 3D model found in response');
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: "3D generation completed but couldn't find the model URL. Check console for details."
          }]);
        }
      }
    } else {
      console.error('No output in 3D response:', res.data);
      setStatus('3D generation failed - no output');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "3D generation failed. Please try again with a different image."
      }]);
    }
  } catch (e) {
    console.error('3D Generation Error:', e);
    console.error('Error response:', e.response?.data);
    setStatus('3D Generation Failed');
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: "3D generation error: " + (e.message || 'Unknown error')
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
          <div className="absolute bottom-8 left-8 right-8 bg-white/80 backdrop-blur-sm rounded-[32px] p-6 border border-white/50 shadow-2xl z-30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Generated Designs</h3>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {generatedImages.length} design{generatedImages.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {generatedImages.map((imgUrl, idx) => (
                <div
                  key={idx}
                  className="relative group cursor-pointer rounded-2xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all duration-300"
                  onClick={() => handleSelectImage(imgUrl)}
                >
                  <img
                    src={imgUrl}
                    alt={`Design ${idx + 1}`}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      console.error('Image failed to load:', imgUrl);
                      e.target.src = `https://placehold.co/400x300/94a3b8/white?text=Design+${idx + 1}`;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="text-white text-xs font-bold">Click to generate 3D</div>
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {idx + 1}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-500 font-medium">
                Click any design to generate a 3D printable model
              </p>
            </div>
          </div>
        )}

        {/* PEDESTAL UI */}
        {showPedestalUI && (
          <PedestalControls
            settings={pedestalSettings}
            setSettings={setPedestalSettings}
            onPrepare={handlePrepareGCode}
          />
        )}

        {/* CONTROL BAR */}
        <div className="absolute top-8 left-8 right-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPedestalUI(!showPedestalUI)}
              className="glass-card px-6 py-3 rounded-2xl text-sm font-bold hover:bg-white/20 transition-all"
            >
              <Settings size={18} className="inline mr-2" />
              Print Settings
            </button>
            {orderSummary && (
              <div className="glass-card px-6 py-3 rounded-2xl">
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
                className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-black transition-all flex items-center gap-2"
              >
                <Download size={18} />
                Order Print
              </button>
            )}
          </div>
        </div>

        {/* STATUS INDICATOR */}
        {status && !loading && (
          <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-lg border border-white/50">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <CheckCircle2 size={16} className="text-green-500" />
              {status}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}