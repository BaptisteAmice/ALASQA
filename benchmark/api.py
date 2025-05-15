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
    "https://query.wikidata.org/sparql/"
]

@app.get("/")
def get_answer(question: str, dataset: str) -> dict:
    """
     Translate a natural language question into a SPARQL query for a given dataset.
    """
    if dataset not in KNOWN_DATASETS:
        raise fastapi.HTTPException(404, "Unknown dataset ...")
    else:
        # text2sparql are just identifiers for the datasets
        # we have to translate them to a real service
        if dataset == "https://text2sparql.aksw.org/2025/dbpedia/":
            dataset = "https://desktop-47kug2k.tail6a5b76.ts.net:3131/dbpedia/sparql"
        elif dataset == "https://text2sparql.aksw.org/2025/corporate/":
            dataset = "https://desktop-47kug2k.tail6a5b76.ts.net:3131/corporate/sparql"
    
    system_name = "sparklisllm-LLMFrameworkText2Sparql"
    driver = interactions.get_new_driver(is_headless=True)
    result, nl_query, error, steps_status, reasoning, _ = interactions.simulated_user(
        config.SPARKLIS_FILE,
        lambda drv: interactions.sparklisllm_question(drv, question, dataset, system_name),
        driver=driver
    )
    driver.close() # should close the page after the api request
    return {
        "dataset": dataset,
        "question": question,
        "query": result
    }
