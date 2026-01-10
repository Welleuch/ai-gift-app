import os
import json
import shutil
import requests
import random
import traceback
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
from dotenv import load_dotenv
import boto3

load_dotenv()
app = FastAPI()

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELS ---
class ChatRequest(BaseModel):
    history: List[Dict[str, str]]

class GenRequest(BaseModel):
    visual_prompt: str

class ThreeDRequest(BaseModel):
    image_url: str

# --- CLOUDFLARE R2 HELPERS ---
def get_r2_client():
    return boto3.client(
        service_name='s3',
        endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
        region_name="auto",
    )

def upload_to_r2(local_path, file_name):
    bucket_name = os.getenv("R2_BUCKET_NAME")
    public_base_url = os.getenv("R2_PUBLIC_URL")
    try:
        client = get_r2_client()
        content_type = "image/png" if file_name.lower().endswith(".png") else "model/gltf-binary"
        client.upload_file(local_path, bucket_name, file_name, ExtraArgs={'ContentType': content_type})
        return f"{public_base_url}/{file_name}"
    except Exception as e:
        print(f"R2 Error: {e}")
        return None

def trigger_workflow(workflow):
    comfy_url = os.getenv("COMFY_URL", "http://127.0.0.1:8188")
    try:
        resp = requests.post(f"{comfy_url}/prompt", json={"prompt": workflow})
        return resp.json().get('prompt_id')
    except Exception as e:
        print(f"ComfyUI Error: {e}")
        return None

# --- API ENDPOINTS ---

@app.post("/api/chat")
async def chat_with_ai(req: ChatRequest):
    # Lean Chat: Just grab user interests
    user_input = req.history[-1]['content']
    return {
        "response": "I'm applying 3D-printing design rules to your idea. Generating preview...",
        "visual_prompt": user_input 
    }

@app.post("/api/generate-images")
async def generate_images(payload: GenRequest):
    try:
        # 1. THE SUCCESSFUL TEMPLATE
        # We only change the {payload.visual_prompt} part.
        perfect_prompt = f"""
        You are a creative product designer and 3D-printing expert.
        I want to offer a 3d printed gift made completely with PLA filament of gray color. 
        The recipient loves: {payload.visual_prompt}.

        Your task is to:
        Propose unique gift idea that is useful, thoughtful, or decorative. 

        Favor designs that:
        - Print without excessive supports and thin walls
        - Avoid ideas that require electronics
        - The final model must be ONE continuous object, with no separate parts, fully connected 3D mesh
        - Please provide a visual design description suitable for generating a 3D model from the front perspective that helps a image to 3d model ai generator to generate a solid printable 3d model.
        - Please take into consideration that the generated image will make the 3d model respects the rules of design for additive manufacturing (DfAM)
        """

        # 2. Path Handling
        base_dir = Path(__file__).resolve().parent.parent 
        with open(base_dir / "workflows" / "stage1_image.json", "r") as f:
            workflow = json.load(f)

        # 3. Inject ONLY the Prompt and the Seed
        # All other settings (Steps, CFG, Res) are now read directly from your JSON
        if "34:27" in workflow:
            workflow["34:27"]["inputs"]["text"] = perfect_prompt
            
        if "34:3" in workflow:
            workflow["34:3"]["inputs"]["seed"] = random.randint(1, 10**14)

        # 4. Trigger
        job_id = trigger_workflow(workflow)
        return {"status": "queued", "job_id": job_id}

    except Exception as e:
        print("ERROR IN GENERATE_IMAGES:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/check-status/{job_id}")
async def check_status(job_id: str):
    comfy_url = os.getenv("COMFY_URL", "http://127.0.0.1:8188")
    try:
        resp = requests.get(f"{comfy_url}/history/{job_id}", timeout=2)
        history = resp.json()
    except: return {"status": "processing"}
    
    if not history or job_id not in history: return {"status": "processing"}
        
    outputs = history[job_id]['outputs']
    urls = []
    output_dir = Path(os.getenv("COMFY_OUTPUT_DIR"))

    # Stage 1 (Images) & Stage 2 (3D) Check
    for node_id in ['9', '10']:
        if node_id in outputs:
            node_data = outputs[node_id]
            # Search for filenames in any list inside the node (images, files, gifs)
            for key in node_data:
                if isinstance(node_data[key], list):
                    for item in node_data[key]:
                        if 'filename' in item:
                            fname = item['filename']
                            # Check root AND mesh/ subfolder
                            src = output_dir / fname
                            if not src.exists(): src = output_dir / "mesh" / os.path.basename(fname)
                            
                            if src.exists():
                                url = upload_to_r2(str(src), os.path.basename(fname))
                                if url: urls.append(url)

    if urls: return {"status": "completed", "images": urls}
    return {"status": "processing"}

@app.post("/api/generate-3d")
async def generate_3d(payload: ThreeDRequest):
    try:
        # 1. Clear VRAM for Stage 2
        requests.post(f"{os.getenv('COMFY_URL')}/free")
        
        # 2. Path Handling
        filename = os.path.basename(payload.image_url)
        src = Path(os.getenv("COMFY_OUTPUT_DIR")) / filename
        dst = Path(os.getenv("COMFY_INPUT_DIR")) / filename
        
        if src.exists():
            shutil.copy2(src, dst)
            print(f"DEBUG: Moved {filename} to input folder")

        # 3. Load Stage 2 Workflow
        base_dir = Path(__file__).resolve().parent.parent 
        with open(base_dir / "workflows" / "stage2_3d.json", "r") as f:
            workflow = json.load(f)

        # 4. Inject ONLY the image name
        # We leave all other settings (steps, cfg, etc.) as they are in your JSON
        if "2" in workflow:
            workflow["2"]["inputs"]["image"] = filename
        
        # Randomize seed just to ensure a fresh run
        if "7" in workflow:
            workflow["7"]["inputs"]["seed"] = random.randint(1, 10**14)

        job_id = trigger_workflow(workflow)
        return {"status": "queued", "job_id": job_id}

    except Exception as e:
        print("ERROR IN GENERATE_3D:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))