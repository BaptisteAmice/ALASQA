"""text2sparql-api"""

import fastapi
from fastapi.staticfiles import StaticFiles
import interactions
import config


app = fastapi.FastAPI(
    title="TEXT2SPARQL API Example",
)

script_dir = config.script_dir

# Serve static files (HTML, JS, CSS)
app.mount("/static", StaticFiles(directory=script_dir+"/../webapp/"), name="static")

KNOWN_DATASETS = [
    "https://text2sparql.aksw.org/2025/dbpedia/",
    "https://text2sparql.aksw.org/2025/corporate/",
    "https://query.wikidata.org/sparql"
]

@app.get("/")
def get_answer(question: str, dataset: str) -> dict:
    """
     Translate a natural language question into a SPARQL query for a given dataset.
    """
    if dataset not in KNOWN_DATASETS:
        raise fastapi.HTTPException(404, "Unknown dataset ...")
    
    system_name = "sparklisllm-LLMFrameworkTheMostImproved" #todo change
    result, nl_query, error, steps_status, reasoning, driver = interactions.simulated_user(
        config.SPARKLIS_FILE,
        lambda driver: interactions.sparklisllm_question(driver, question, dataset, system_name)
    )
    driver.close() # should close the page after the api request
    return {
        "dataset": dataset,
        "question": question,
        "query": result
    }

# @app.get("/fetch")
# def fetch_local_page(question: str, endpoint_sparql: str = config.SPARQL_ENDPOINT, system_name: str = "sparklisllm-LLMFrameworkOneShot") -> str:
#     """
#     Draft of the "/" endpoint. #todo
#     """
#     result, nl_query, error, steps_status, reasoning, driver = interactions.simulated_user(
#         config.SPARKLIS_FILE,
#         lambda driver: interactions.sparklisllm_question(driver, question, endpoint_sparql, system_name)
#     )
#     driver.close() # should close the page after the api request
#     return response
