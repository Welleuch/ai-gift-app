import os
import json
import shutil
import requests
import random
import traceback
import subprocess
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
from dotenv import load_dotenv
import boto3
import re

load_dotenv()
app = FastAPI()

# --- CORS: ALLOW YOUR CLOUDFLARE URL ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURATION ---
PRUSA_PATH = r"C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer-console.exe"

# --- MODELS ---
class ChatRequest(BaseModel):
    history: List[Dict[str, str]]

class GenRequest(BaseModel):
    visual_prompt: str

class ThreeDRequest(BaseModel):
    image_url: str

# --- R2 HELPERS ---
def get_r2_client():
    return boto3.client(
        service_name='s3',
        endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
        region_name="auto",
    )

def upload_to_r2(local_path, file_name):
    try:
        client = get_r2_client()
        content_type = "image/png" if file_name.endswith(".png") else "model/gltf-binary"
        if file_name.endswith(".gcode"): content_type = "text/x.gcode"
        
        client.upload_file(local_path, os.getenv("R2_BUCKET_NAME"), file_name, ExtraArgs={'ContentType': content_type})
        return f"{os.getenv('R2_PUBLIC_URL')}/{file_name}"
    except Exception as e:
        print(f"R2 Error: {e}")
        return None

def trigger_workflow(workflow):
    try:
        resp = requests.post(f"{os.getenv('COMFY_URL')}/prompt", json={"prompt": workflow})
        return resp.json().get('prompt_id')
    except: return None

# --- API ENDPOINTS ---

@app.post("/api/chat")
async def chat_with_ai(req: ChatRequest):
    user_input = req.history[-1]['content']
    return {
        "response": "Applying 3D-printing design rules... drawing your gift now!",
        "visual_prompt": user_input 
    }

@app.post("/api/generate-images")
async def generate_images(payload: GenRequest):
    try:
        template = f"Product designer prompt: {payload.visual_prompt}. Style: matte gray PLA, 3D printed figurine, solid geometry, white background."
        
        base_dir = Path(__file__).resolve().parent.parent 
        with open(base_dir / "workflows" / "stage1_image.json", "r") as f:
            workflow = json.load(f)

        if "34:27" in workflow: workflow["34:27"]["inputs"]["text"] = template
        if "34:3" in workflow: workflow["34:3"]["inputs"]["seed"] = random.randint(1, 10**14)
        
        job_id = trigger_workflow(workflow)
        return {"status": "queued", "job_id": job_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/check-status/{job_id}")
async def check_status(job_id: str):
    try:
        resp = requests.get(f"{os.getenv('COMFY_URL')}/history/{job_id}", timeout=2)
        history = resp.json()
        if not history or job_id not in history: return {"status": "processing"}
        
        outputs = history[job_id]['outputs']
        urls = []
        out_dir = Path(os.getenv("COMFY_OUTPUT_DIR"))

        for node_id in ['9', '10']:
            if node_id in outputs:
                for key in outputs[node_id]:
                    if isinstance(outputs[node_id][key], list):
                        for item in outputs[node_id][key]:
                            if 'filename' in item:
                                fname = item['filename']
                                src = out_dir / fname
                                if not src.exists(): src = out_dir / "mesh" / os.path.basename(fname)
                                if src.exists():
                                    url = upload_to_r2(str(src), os.path.basename(fname))
                                    if url: urls.append(url)
        return {"status": "completed", "images": urls}
    except: return {"status": "processing"}

@app.post("/api/generate-3d")
async def generate_3d(payload: ThreeDRequest):
    try:
        requests.post(f"{os.getenv('COMFY_URL')}/free")
        filename = os.path.basename(payload.image_url)
        shutil.copy2(Path(os.getenv("COMFY_OUTPUT_DIR")) / filename, Path(os.getenv("COMFY_INPUT_DIR")) / filename)

        base_dir = Path(__file__).resolve().parent.parent 
        with open(base_dir / "workflows" / "stage2_3d.json", "r") as f:
            workflow = json.load(f)

        workflow["2"]["inputs"]["image"] = filename
        job_id = trigger_workflow(workflow)
        return {"status": "queued", "job_id": job_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/slice")
async def slice_model(file: UploadFile = File(...)):
    try:
        job_id = str(random.randint(1000, 9999))
        temp_stl = Path(f"temp_{job_id}.stl")
        output_gcode = f"gift_{job_id}.gcode"

        with open(temp_stl, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        config_path = Path(__file__).resolve().parent.parent / "config.ini"
        command = [PRUSA_PATH, "--export-gcode", "--load", str(config_path), "--output", output_gcode, str(temp_stl)]
        
        print(f"DEBUG: Slicing job {job_id}...")
        subprocess.run(command, check=True, capture_output=True)

        # --- SMART METADATA EXTRACTION ---
        volume_cm3 = 0.0
        print_time = "Unknown"
        
        if Path(output_gcode).exists():
            with open(output_gcode, "r") as f:
                content = f.read()
                
                # 1. Search for Volume (more reliable than weight)
                volume_match = re.search(r"filament used \[cm3\]\s*=\s*([\d\.]+)", content)
                if volume_match:
                    volume_cm3 = float(volume_match.group(1))
                
                # 2. Search for Time
                time_match = re.search(r"estimated printing time \(normal mode\)\s*=\s*(.*)", content)
                if time_match:
                    print_time = time_match.group(1).strip()

        # --- CALCULATE WEIGHT & PRICE ---
        weight_g = volume_cm3 * 1.24
        material_cost = weight_g * 0.03 
        
        # Add a "Size Premium" if the object is large (uses more machine time)
        machine_time_cost = (weight_g / 10) * 1.5 # 1.5€ for every 10g of print
        
        total_price = material_cost + machine_time_cost + 5 + 7

        gcode_url = upload_to_r2(output_gcode, output_gcode)
        
        # Cleanup
        if temp_stl.exists(): temp_stl.unlink()
        if Path(output_gcode).exists(): Path(output_gcode).unlink()

        return {
            "status": "success",
            "gcode_url": gcode_url,
            "weight": round(weight_g, 2),
            "print_time": print_time,
            "price": round(total_price, 2)
        }
    except Exception as e:
        print(f"ERROR: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}