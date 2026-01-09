import os
import json
import shutil
import requests
import re
import random
import traceback
import base64
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
from dotenv import load_dotenv
import boto3 # Install via: pip install boto3


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

# --- HELPERS ---

def query_ollama(model, messages):
    url = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
    payload = {"model": model, "messages": messages, "stream": False, "options": {"temperature": 0.8}}
    try:
        resp = requests.post(url, json=payload, timeout=40)
        return resp.json()['message']['content']
    except Exception as e:
        print(f"Ollama Error: {e}")
        return "Error connecting to AI."

def analyze_image_with_vlm(image_path):
    """The Gatekeeper: Asks Llava if the image is actually a 3D solid."""
    try:
        with open(image_path, "rb") as f:
            b64_string = base64.b64encode(f.read()).decode('utf-8')
        
        url = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
        payload = {
            "model": "llava",
            "messages": [{
                "role": "user",
                "content": "Does this image contain floating stars, speech bubbles, or 2D sketches in the corner? Answer only FAIL if it has them, or PASS if it is a clean solid object.",
                "images": [b64_string]
            }],
            "stream": False
        }
        resp = requests.post(url, json=payload, timeout=30)
        result = resp.json()['message']['content'].upper()
        print(f"DEBUG: VLM Result for {os.path.basename(image_path)}: {result}")
        return "PASS" in result
    except Exception as e:
        print(f"VLM Error: {e}")
        return True # Default to true if VLM is offline

def trigger_workflow(workflow):
    comfy_url = os.getenv("COMFY_URL", "http://127.0.0.1:8188")
    try:
        resp = requests.post(f"{comfy_url}/prompt", json={"prompt": workflow})
        return resp.json().get('prompt_id')
    except Exception as e:
        print(f"ComfyUI Trigger Error: {e}")
        return None

# --- Cloudflare R2 Client ---
s3_client = boto3.client(
    service_name='s3',
    endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
    aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
    region_name="auto",
)

# --- CLOUDFLARE R2 SETUP ---
# We create the client inside a function or ensure it's initialized after load_dotenv()
def get_r2_client():
    return boto3.client(
        service_name='s3',
        endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
        region_name="auto",
    )

def upload_to_r2(local_path, file_name):
    """Uploads file to R2 with correct MIME types for 3D and 2D"""
    bucket_name = os.getenv("R2_BUCKET_NAME")
    public_base_url = os.getenv("R2_PUBLIC_URL")
    
    try:
        client = get_r2_client()
        
        # CRITICAL: MIME types for browser compatibility
        if file_name.lower().endswith(".png"):
            content_type = "image/png"
        elif file_name.lower().endswith(".glb"):
            content_type = "model/gltf-binary"  # Required for Three.js
        else:
            content_type = "application/octet-stream"

        client.upload_file(
            local_path, 
            bucket_name, 
            file_name,
            ExtraArgs={'ContentType': content_type}
        )
        
        url = f"{public_base_url}/{file_name}"
        print(f"DEBUG: R2 UPLOAD SUCCESS: {url}")
        return url
    except Exception as e:
        print(f"DEBUG: R2 UPLOAD ERROR: {e}")
        return None

def log_order_to_d1(order_data: dict):
    """Logs the generation to D1 via API"""
    # Cloudflare provides a REST API to query D1 from external backends
    url = f"https://api.cloudflare.com/client/v4/accounts/{os.getenv('R2_ACCOUNT_ID')}/d1/database/{os.getenv('D1_DB_ID')}/query"
    headers = {"Authorization": f"Bearer {os.getenv('CF_API_TOKEN')}"}
    
    sql = "INSERT INTO orders (id, user_input, visual_prompt, status) VALUES (?, ?, ?, ?)"
    payload = {"sql": sql, "params": [order_data['id'], order_data['input'], order_data['prompt'], 'pending']}
    
    requests.post(url, json=payload, headers=headers)

# --- API ENDPOINTS ---

@app.post("/api/chat")
async def chat_with_ai(req: ChatRequest):
    system_prompt = {
        "role": "system", 
        "content": """
        You are a Creative 3D Product Designer. Merge user interests into ONE funny physical object.
        RULES:
        1. Always merge ideas (e.g. Dog + Pizza = Dog sitting on pizza base).
        2. No floating parts. No sketches.
        Format: {"visual_prompt": "A macro studio photo of a [DESCRIPTION] figurine"}
        """
    }
    full_conversation = [system_prompt] + req.history
    response_text = query_ollama(os.getenv("LLM_MODEL", "llama3.1"), full_conversation)
    
    visual_prompt = None
    json_match = re.search(r"\{.*\"visual_prompt\".*\}", response_text, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group(0))
            visual_prompt = data.get("visual_prompt")
        except: pass

    return {"response": response_text, "visual_prompt": visual_prompt}

@app.post("/api/generate-images")
async def generate_images(payload: GenRequest):
    try:
        user_prompt = payload.visual_prompt
        
        # Force photography style and Gray PLA
        pos_mod = "physical figurine, 3D printed matte gray PLA plastic, wide flat base, solid chunky geometry, macro photography, white studio background, sharp focus"
        neg_mod = "stars, speech bubbles, 2D sketches, icons, logo, text, stickers, wireframe, floating parts, separate pieces, thin whiskers"
        
        base_dir = Path(__file__).resolve().parent.parent 
        with open(base_dir / "workflows" / "stage1_image.json", "r") as f:
            workflow = json.load(f)

        # Inject into your NEW stage1_image nodes
        if "34:27" in workflow: workflow["34:27"]["inputs"]["text"] = f"{user_prompt}, {pos_mod}"
        if "34:33" in workflow: workflow["34:33"]["inputs"]["text"] = neg_mod # Now works as CLIPText
        
        if "34:3" in workflow:
            workflow["34:3"]["inputs"]["seed"] = random.randint(1, 10**14)
            workflow["34:3"]["inputs"]["cfg"] = 2.5 # Forced CFG to enforce negative rules
            workflow["34:3"]["inputs"]["steps"] = 8
        
        if "34:13" in workflow:
            workflow["34:13"]["inputs"]["width"] = 768
            workflow["34:13"]["inputs"]["height"] = 768
            workflow["34:13"]["inputs"]["batch_size"] = 1

        job_id = trigger_workflow(workflow)
        return {"status": "queued", "job_id": job_id}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/check-status/{job_id}")
async def check_status(job_id: str):
    comfy_url = os.getenv("COMFY_URL", "http://127.0.0.1:8188")
    try:
        resp = requests.get(f"{comfy_url}/history/{job_id}", timeout=2)
        history = resp.json()
    except:
        return {"status": "processing"}
    
    if not history or job_id not in history:
        return {"status": "processing"}
        
    outputs = history[job_id]['outputs']
    files_to_return = []
    dst_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "generated"
    dst_dir.mkdir(parents=True, exist_ok=True)

    # --- STAGE 1: IMAGES (Node 9) ---
    if '9' in outputs:
        for item in outputs['9']['images']:
            fname = item['filename']
            src = Path(os.getenv("COMFY_OUTPUT_DIR")) / fname
            if src.exists():
                # For Local dev, we still copy to public
                shutil.copy2(src, dst_dir / os.path.basename(fname))
                # For Cloud dev, we upload to R2
                url = upload_to_r2(str(src), os.path.basename(fname))
                if url: files_to_return.append(url)

    # --- STAGE 2: 3D MESH (Node 10) ---
    if '10' in outputs:
        # Search every sub-key (gifs, files, etc) in Node 10
        node_output = outputs['10']
        for key in node_output:
            if isinstance(node_output[key], list):
                for item in node_output[key]:
                    if 'filename' in item:
                        fname = item['filename'] # e.g. "mesh/ComfyUI_0001.glb"
                        src = Path(os.getenv("COMFY_OUTPUT_DIR")) / fname
                        
                        if src.exists():
                            clean_name = os.path.basename(fname)
                            print(f"DEBUG: Found 3D Mesh {clean_name}, uploading...")
                            # Upload to R2
                            url = upload_to_r2(str(src), clean_name)
                            if url: files_to_return.append(url)
                        else:
                            print(f"DEBUG: 3D file mentioned in history but not found at {src}")

    if files_to_return:
        return {"status": "completed", "images": files_to_return}
    
    return {"status": "processing"}

@app.post("/api/generate-3d")
async def generate_3d(payload: ThreeDRequest):
    try:
        requests.post(f"{os.getenv('COMFY_URL')}/free")
        image_url = payload.image_url
        filename = os.path.basename(image_url)
        src = Path(os.getenv("COMFY_OUTPUT_DIR")) / filename
        dst = Path(os.getenv("COMFY_INPUT_DIR")) / filename
        if src.exists(): shutil.copy2(src, dst)

        base_dir = Path(__file__).resolve().parent.parent 
        with open(base_dir / "workflows" / "stage2_3d.json", "r") as f:
            workflow = json.load(f)

        workflow["2"]["inputs"]["image"] = filename
        if "4" in workflow: workflow["4"]["inputs"]["resolution"] = 512
        if "7" in workflow: 
            workflow["7"]["inputs"]["cfg"] = 3.0
            workflow["7"]["inputs"]["seed"] = random.randint(1, 10**14)
        if "17" in workflow: workflow["17"]["inputs"]["background_color"] = "#FFFFFF"

        job_id = trigger_workflow(workflow)
        return {"status": "queued", "job_id": job_id}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))