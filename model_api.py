from fastapi import FastAPI
from transformers import AutoTokenizer, AutoModelForCausalLM
import os

app = FastAPI()
model_path = os.path.abspath("./mpt-7b-storywriter")
os.environ["HUGGINGFACE_HUB_CACHE"] = model_path

model_name = "mosaicml/mpt-7b-storywriter"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name)

@app.get("/generate_story")
async def generate_story(prompt: str = "Three cats are"):
    input_ids = tokenizer(prompt, return_tensors="pt").input_ids
    output = model.generate(input_ids, max_length=5, num_return_sequences=1)

    generated_text = tokenizer.decode(output[0], skip_special_tokens=True)
    
    return {
        "prompt": prompt,
        "generated_text": generated_text
    }

# you may need to type command if requirements.txt not work fully
# pip install uvicorn

# start server:
# uvicorn model_api:app --reload --log-level debug

# query via url
# http://url:8000/generate_story?prompt=Three%20cats%20are
