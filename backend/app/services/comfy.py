import json
import requests
import shutil
import os
import uuid
from typing import List

# Setup Paths
COMFY_URL = "http://127.0.0.1:8188"
COMFY_INPUT_DIR = "C:/Path/To/ComfyUI/input"   # <--- UPDATE THIS REAL PATH
COMFY_OUTPUT_DIR = "C:/Path/To/ComfyUI/output" # <--- UPDATE THIS REAL PATH

def queue_prompt(workflow_json):
    """Sends workflow to ComfyUI"""
    p = {"prompt": workflow_json}
    data = json.dumps(p).encode('utf-8')
    resp = requests.post(f"{COMFY_URL}/prompt", data=data)
    return resp.json()['prompt_id']

def generate_stage_1_images(visual_prompt: str) -> str:
    """
    1. Loads Stage 1 JSON
    2. Injects prompt into Node 34:27
    3. Triggers Generation
    """
    with open("workflows/stage1_image.json", "r") as f:
        workflow = json.load(f)

    # --- INJECTION LOGIC ---
    # Node 34:27 is your CLIP Text Encode
    workflow["34:27"]["inputs"]["text"] = visual_prompt
    
    # Optional: Set a random seed for Node 34:3 (KSampler) so results vary
    import random
    workflow["34:3"]["inputs"]["seed"] = random.randint(1, 1000000000000)

    prompt_id = queue_prompt(workflow)
    return prompt_id

def generate_stage_2_3d(selected_image_filename: str) -> str:
    """
    1. Moves image from Output -> Input folder (Crucial Step)
    2. Loads Stage 2 JSON
    3. Injects filename into Node 2
    4. Triggers Generation
    """
    
    # --- THE BRIDGE: Copy file from Output to Input ---
    # ComfyUI Output (where Stage 1 saved it) -> ComfyUI Input (where Stage 2 looks)
    source = os.path.join(COMFY_OUTPUT_DIR, selected_image_filename)
    destination = os.path.join(COMFY_INPUT_DIR, selected_image_filename)
    
    if os.path.exists(source):
        shutil.copy2(source, destination)
    else:
        print(f"Error: Could not find {source}")

    # --- LOAD WORKFLOW ---
    with open("workflows/stage2_3d.json", "r") as f:
        workflow = json.load(f)

    # --- INJECTION LOGIC ---
    # Node 2 is your Load Image node
    workflow["2"]["inputs"]["image"] = selected_image_filename
    
    # Optional: Set random seed for Node 7 (KSampler)
    import random
    workflow["7"]["inputs"]["seed"] = random.randint(1, 1000000000000)

    prompt_id = queue_prompt(workflow)
    return prompt_id