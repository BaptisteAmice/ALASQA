"""text2sparql-api"""

import fastapi
import httpx


app = fastapi.FastAPI(
    title="TEXT2SPARQL API Example",
)

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

#todo use playwright?
#todo acceder page locale
@app.get("/fetch")
def fetch_local_page():
    url = "http://www.irisa.fr/LIS/ferre/sparklis/"  # Remplace par l'URL de ta page locale
    try:
        response = httpx.get(url)
        return {"status": response.status_code, "content": response.text}
    except httpx.RequestError as e:
        return {"error": str(e)}