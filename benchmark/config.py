import os
import logging
import benchmark_extraction
script_dir = os.path.dirname(os.path.realpath(__file__))

# FILE TO BE MODIFIED BY THE USER

# Logging level and file
log_file = script_dir + '/app.log'
logging.basicConfig(
    level=logging.INFO, # NOTSET | DEBUG | INFO | WARNING | ERROR | CRITICAL
    handlers=[
        logging.StreamHandler(),  # Prints to console
        logging.FileHandler(log_file, mode="w")  # Writes to a file
    ]
)

# time constraint for a single question (in seconds)
SYSTEM_TIMEOUT = 5000

# Number of queries executed between each save for a benchmark evaluation
BATCH_SIZE = 1

# Location of the Sparklis file (local or remote)
SPARKLIS_FILE = "http://localhost:8000/static/osparklis.html"

# Location of the LLM API (not used by Sparklis, but just to test if it is reachable when running the benchmark), to update in llm_utils.js if you want to use a different API
LLM_API = 'http://localhost:1234/v1/'
LLM_API_MODEL = LLM_API + 'models'

# User agent for the simulated browser (to avoid being blocked)
USER_AGENT = 'SparklisLLM/0.1 ; baptiste.amice@irisa.fr'

# Output folder
OUTPUT_FOLDER = script_dir + '/Outputs/'

####### 

# number of time to test the dataset and of output files to generate
NB_TESTS = 3

# Input json file containing the benchmark
#BENCHMARK_FILE = script_dir + '/Inputs/' + 'qald_10_patched.json'
BENCHMARK_FILE = script_dir + '/Inputs/' + 'qald_9_plus_train_wikidata_patched.json'

# Name of the tested benchmark (MINTAKA1K | QALD10 | QALD9_PLUS)
BENCHMARK_NAME = benchmark_extraction.QALD9_PLUS
# Filter on the extracted questions of the benchmark (e.g., {} to get all questions, {"tags": lambda x: x is not None and "aggregation" in x} to get only the questions with the tag "aggregation" in a QALD benchmark)
BENCHMARK_QUESTIONS_FILTER = {"tags": lambda x: x is not None and "the most" in x}

# Separating the language in 2 variable enable different approaches (e.g., reasoning in the question language if the 2 are the same, or translating the question in the system language)
# Language in which the question of the benchmark are extracted
LANGUAGE_QUESTIONS = 'en'
# Language in which Sparklis will be used to answer the questions
LANGUAGE_SPARKLIS = 'en'

# If True, the browser is hidden during the benchmark evaluation (less heavy, but less readable)
HIDE_BROWSER_ON_BENCHMARK_EVALUATION = True

# Name of the tested system
TESTED_SYSTEM = 'sparklisllm-LLMFrameworkText2Sparql' # dummy | sparklisllm-[specific_system_name]

# SPARQL endpoint, only used in scripts and not by the API
#SPARQL_ENDPOINT = 'https://dbpedia.org/sparql'
SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
#SPARQL_ENDPOINT = 'https://skynet.coypu.org/wikidata/'