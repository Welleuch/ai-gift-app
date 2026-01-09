import boto3
import os
from dotenv import load_dotenv
import requests


load_dotenv()

# R2 Configuration
r2 = boto3.client(
    service_name='s3',
    endpoint_url=f"https://{os.getenv('CF_ACCOUNT_ID')}.r2.cloudflarestorage.com",
    aws_access_key_id=os.getenv('CF_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('CF_SECRET_ACCESS_KEY'),
    region_name='auto' # Must be one of auto, eeur, weur, wnam, enam, apac, auto
)

BUCKET_NAME = "ai-gift-assets"

def upload_file_to_r2(file_path, object_name):
    """Uploads a local file to real Cloudflare R2 storage"""
    try:
        r2.upload_file(file_path, BUCKET_NAME, object_name)
        # Return the public URL (if you setup a custom domain) or signed URL
        return f"https://your-custom-domain.com/{object_name}"
    except Exception as e:
        print(f"Upload failed: {e}")
        return None


def query_d1(sql, params=[]):
    """Executes SQL on real Cloudflare D1 via API"""
    url = f"https://api.cloudflare.com/client/v4/accounts/{os.getenv('CF_ACCOUNT_ID')}/d1/database/{os.getenv('D1_DB_ID')}/query"
    
    headers = {
        "Authorization": f"Bearer {os.getenv('CF_API_TOKEN')}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "sql": sql,
        "params": params
    }
    
    response = requests.post(url, json=payload, headers=headers)
    return response.json()