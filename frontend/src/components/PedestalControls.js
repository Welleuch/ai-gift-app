"use client";
import { Settings, Type, Maximize, CheckCircle2, Ruler } from 'lucide-react';

export default function PedestalControls({ settings, setSettings, onPrepare }) {
  return (
    <div className="absolute top-12 right-8 w-80 glass-card rounded-[32px] p-8 shadow-2xl z-50 border border-white/50 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-4">
        <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
          <Ruler size={20} />
        </div>
        <div>
          <h3 className="font-extrabold text-slate-800">Print Size</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase">Max: 100 x 100 mm</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Shape Toggle */}
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button onClick={() => setSettings({...settings, shape: 'cylinder'})}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${settings.shape === 'cylinder' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
              Round
            </button>
            <button onClick={() => setSettings({...settings, shape: 'box'})}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${settings.shape === 'box' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
              Square
            </button>
        </div>

        {/* Real Dimensions Readout */}
        <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100">
            <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase">Width</p>
                <p className="text-sm font-mono font-bold text-slate-700">{settings.width}mm</p>
            </div>
            <div className="text-center border-x border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase">Depth</p>
                <p className="text-sm font-mono font-bold text-slate-700">{settings.depth}mm</p>
            </div>
            <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase">Height</p>
                <p className="text-sm font-mono font-bold text-slate-700">{settings.height}mm</p>
            </div>
        </div>

        {/* Sliders */}
        <div className="space-y-4">
          <DimensionSlider label="Base Width" val={settings.width} min={20} max={100} 
            onChange={(v) => setSettings({...settings, width: v, depth: settings.shape === 'cylinder' ? v : settings.depth})} />
          
          {settings.shape === 'box' && (
            <DimensionSlider label="Base Depth" val={settings.depth} min={20} max={100} 
                onChange={(v) => setSettings({...settings, depth: v})} />
          )}

          <DimensionSlider label="Base Height" val={settings.height} min={5} max={30} 
            onChange={(v) => setSettings({...settings, height: v})} />
          
          <DimensionSlider label="Model Lift" val={settings.offset} min={-50} max={50} 
            onChange={(v) => setSettings({...settings, offset: v})} color="accent-orange-500" />

          <DimensionSlider label="Model Scale" val={settings.scale} min={0.1} max={3.0} step={0.1}
            onChange={(v) => setSettings({...settings, scale: v})} color="accent-green-500" />
<DimensionSlider 
  label="Model Back/Front" 
  val={settings.modelZOffset || 0} 
  min={-50} 
  max={50} 
  step={1}
  onChange={(v) => setSettings({...settings, modelZOffset: v})} 
  color="accent-purple-500" 
/>
        </div>

        {/* Text Input */}
       <div>
  <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Headline</label>
  <input 
    type="text" 
    className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm mb-4"
    value={settings.textLine1 || ""} 
    onChange={(e) => setSettings({...settings, textLine1: e.target.value})} 
  />
  
  <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Signature</label>
  <input 
    type="text" 
    className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm"
    value={settings.textLine2 || ""} 
    onChange={(e) => setSettings({...settings, textLine2: e.target.value})} 
  />
</div>

        <button onClick={onPrepare} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm hover:bg-black transition-all flex items-center justify-center gap-2">
          <CheckCircle2 size={18} /> HIDE SETTINGS
        </button>
      </div>
    </div>
  );
}

function DimensionSlider({ label, val, min, max, step=1, onChange, color="accent-blue-600" }) {
    return (
        <div>
            <div className="flex justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{label}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => onChange(parseFloat(e.target.value))}
                className={`w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer ${color}`} />
        </div>
    )
}