from contextlib import asynccontextmanager
from fastapi import FastAPI
from transformers import AutoTokenizer, AutoModelForCausalLM
import os
import time

model_path = os.path.abspath("./mpt-7b-storywriter")
os.environ["HUGGINGFACE_HUB_CACHE"] = model_path
model_name = "mosaicml/mpt-7b-storywriter"

# to make it lazily load
tokenizer = None
model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global tokenizer, model
    print("Loading model and tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name)
    print("Model and tokenizer loaded.")
    yield 

app = FastAPI(lifespan=lifespan)

@app.get("/generate-txt")
async def generate_txt(prompt: str):   
    # prompt = data.get("prompt", "Three cats are") # if @app.post
    
    start_inference = time.perf_counter()
    input_ids = tokenizer(prompt, return_tensors="pt").input_ids
    output = model.generate(input_ids, max_length=5, num_return_sequences=1)
    generated_text = tokenizer.decode(output[0], skip_special_tokens=True)
    inference_time = time.perf_counter() - start_inference
    print(f"Inference for prompt '{prompt}' took {inference_time:.2f} seconds.")
    
    return {
        "prompt": prompt,
        "generated_text": generated_text,
        "inference_time": inference_time
    }

@app.get("/")
async def health_check():
    return {"status": "OK"}


# manual start server:
# uvicorn model_api:app --reload --log-level debug

# query via url
# http://url/generate-txt?prompt=Three%20cats%20are

# runtime command
# uvicorn model_api:app --host 0.0.0.0 --port #
