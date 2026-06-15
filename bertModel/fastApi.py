import os
import sys
import torch
import time
import logging
import psutil
from logging.handlers import RotatingFileHandler
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification

log_formatter = logging.Formatter("%(asctime)s - [%(levelname)s] - %(message)s")

file_handler = RotatingFileHandler("model_trace.log", maxBytes=5*1024*1024, backupCount=2)
file_handler.setFormatter(log_formatter)

console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

logging.basicConfig(level=logging.INFO, handlers=[file_handler, console_handler])

app = FastAPI()

def get_ram_usage():
    process = psutil.Process(os.getpid())
    mem_mb = process.memory_info().rss / (1024 * 1024)
    return mem_mb

logging.info(f"System boot RAM usage: {get_ram_usage():.2f} MB")
logging.info("Initializing system and checking for models...")

fine_tuned_model_path = "fine_tuned_model"
model_loaded = False
tokenizer = None
model = None

if os.path.exists(fine_tuned_model_path):
    logging.info("Local model folder found. Attempting to load offline...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(
            fine_tuned_model_path, 
            local_files_only=True
        )
        model = AutoModelForSequenceClassification.from_pretrained(
            fine_tuned_model_path, 
            local_files_only=True
        )
        model_loaded = True
        logging.info(f"Local fine-tuned model loaded. RAM usage now: {get_ram_usage():.2f} MB")
    except Exception as e:
        logging.error(f"Failed to load local model: {e}")
else:
    logging.warning("Local model directory does not exist.")

if not model_loaded:
    print("\n" + "="*60)
    print("LOCAL MODEL NOT FOUND OR CORRUPTED")
    print("The system cannot find a valid local model to run offline.")
    print("Do you want to download the base model from Hugging Face? (~400MB)")
    print("Requires active internet connection.")
    print("="*60)
    
    user_choice = input("Download and continue? (y/n): ").strip().lower()
    
    if user_choice == 'y':
        logging.info("Downloading base model from Hugging Face...")
        try:
            model_name = "HooshvareLab/bert-fa-base-uncased-sentiment-deepsentipers-binary"
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSequenceClassification.from_pretrained(model_name)
            logging.info(f"Base model loaded. RAM usage now: {get_ram_usage():.2f} MB")
        except Exception as e:
            logging.error(f"Failed to download the model. Check your internet connection. Error: {e}")
            sys.exit(1)
    else:
        logging.info("Model download cancelled by user. Shutting down server...")
        sys.exit(0)

device = "cuda" if torch.cuda.is_available() else "cpu"
model.to(device)

logging.info(f"AI Engine is fully operational! Running on: {device.upper()}")

class CommentRequest(BaseModel):
    comments: list[dict] 

@app.post("/analyze/")
async def analyze_comments(request: CommentRequest):
    logging.info("Received a new request for sentiment analysis.")

    comments = request.comments
    if not comments:
        logging.warning("No comments provided in request!")
        raise HTTPException(status_code=400, detail="No comments provided!")

    start_ram = get_ram_usage()
    logging.info(f"Processing {len(comments)} comments. RAM before inference: {start_ram:.2f} MB")

    start_total_time = time.time()

    batch_texts = [comment["text"] for comment in comments]

    tokens = tokenizer(batch_texts, return_tensors="pt", padding=True, truncation=True, max_length=512).to(device)

    with torch.no_grad():
        outputs = model(**tokens)

    probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)

    results = []
    for i, comment in enumerate(comments):
        negative_prob = probabilities[i][0].item() * 100
        positive_prob = probabilities[i][1].item() * 100
        sentiment = "Positive" if positive_prob > negative_prob else "Negative"

        results.append({
            "id": comment["id"],
            "text": comment["text"],
            "sentiment": sentiment,
            "positive": f"{positive_prob:.2f}%",
            "negative": f"{negative_prob:.2f}%"
        })

    total_processing_time = time.time() - start_total_time
    end_ram = get_ram_usage()
    
    logging.info(f"Processing completed in {total_processing_time:.4f} seconds.")
    logging.info(f"RAM after inference: {end_ram:.2f} MB (Spike: {end_ram - start_ram:.2f} MB)")

    return {
        "processing_time": f"{total_processing_time:.4f} seconds",
        "results": results
    }

if __name__ == "__main__":
    import uvicorn
    logging.info("Starting FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)