"""text2sparql-api"""

import fastapi
from fastapi.staticfiles import StaticFiles
import os
import interactions


app = fastapi.FastAPI(
    title="TEXT2SPARQL API Example",
)

script_dir = os.path.dirname(os.path.realpath(__file__))

# Serve static files (HTML, JS, CSS) #todo test
app.mount("/static", StaticFiles(directory=script_dir+"/../webapp/"), name="static")
#http://127.0.0.1:8000/static/osparklis.html

KNOWN_DATASETS = [
    "https://text2sparql.aksw.org/2025/dbpedia/",
    "https://text2sparql.aksw.org/2025/corporate/"
]

@app.get("/")
async def get_answer(question: str, dataset: str):
    if dataset not in KNOWN_DATASETS:
        raise fastapi.HTTPException(404, "Unknown dataset ...")
    return {
        "dataset": dataset,
        "question": question,
        "query": "... SPARQL here ..."
    }



#todo use playwright? or cypress(non payant)? selenium?//or just trigger events
#todo acceder page locale
@app.get("/fetch")
def fetch_local_page(question: str):
    response = interactions.simulated_user(
        "http://127.0.0.1:8000/static/osparklis.html",
        lambda driver: interactions.sparklisllm_question(driver, question)
        )
    return response
