"""
This file is used to manually configure the benchmark evaluation parameters.
"""
import os
import logging
import benchmark_extraction
from dotenv import load_dotenv

load_dotenv() # Load environment variables from a .env file if it exists
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
LLM_API = 'http://localhost:1234/v1/' # http://localhost:1234/v1/ with LMStudio, https://api.openai.com/v1/ for OpenAI
LLM_API_MODELS = LLM_API + 'models' # LLM_API + 'models' get the list of available models
LLM_API_MODEL_NAME = None # If None, the first model in the list will be used, else it will use the specified model name (e.g., "gpt-4o-mini", "gpt-4o", etc.)
LLM_API_CHAT_COMPLETIONS = LLM_API + 'chat/completions' # e.g., "http://localhost:1234/v1/chat/completions"
LLM_API_KEY = os.getenv('LLM_API_KEY') or None # If None, the API key will not be used (e.g., for LMStudio), else it will use the specified API key (e.g., "sk-...") to access the LLM API

NL_POST_PROCESSING = False # If True, the answers will be post-processed into natural language

# User agent for the simulated browser (to avoid being blocked)
USER_AGENT = 'ALASQA/0.2 ; baptiste.amice@irisa.fr'

# Output folder
OUTPUT_FOLDER = script_dir + '/Outputs/'

####### 

# number of time to test the dataset and of output files to generate
NB_TESTS = 3

# Input json file containing the benchmark
#BENCHMARK_FILE = script_dir + '/Inputs/' + 'qald_10_patched.json'
BENCHMARK_FILE = script_dir + '/Inputs/' + 'qald_9_plus_train_wikidata_patched.json'

# Name of the tested benchmark (MINTAKA1K | QALD10 | QALD9_PLUS | TEXT2SPARQL)
BENCHMARK_NAME = benchmark_extraction.QALD9_PLUS
# Filter on the extracted questions of the benchmark (examples: {} to get all questions, {"tags": lambda x: x is not None and "aggregation" in x} to only get the questions with the tag "aggregation" in a QALD benchmarks, {"answers": lambda answers: any("boolean" in answer for answer in answers)} to only get boolean questions in a QALD benchmark)
BENCHMARK_QUESTIONS_FILTER = {}

# Separating the language in 2 variable enable different approaches (e.g., reasoning in the question language if the 2 are the same, or translating the question in the system language)
# Language in which the question of the benchmark are extracted
LANGUAGE_QUESTIONS = 'en'
# Language in which Sparklis will be used to answer the questions
LANGUAGE_SPARKLIS = 'en'

# If True, the browser is hidden during the benchmark evaluation (less heavy, but less readable)
HIDE_BROWSER_ON_BENCHMARK_EVALUATION = True

# Name of the tested system and its strategy
TESTED_SYSTEM = 'sparklisllm-LLMFrameworkOneShot' # dummy | sparklisllm-[specific_strategy_name]

# Logic used to choose among suggestions
SUGGESTION_COMMANDS_TACTIC = 'best_at_individual_cmd' # best_at_individual_cmd | depth_first_search | beam_search

# SPARQL endpoint, only used in scripts and not by the API
#SPARQL_ENDPOINT = 'https://dbpedia.org/sparql'
SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'

# We need to specify the endpoint in the url and not just set it later, else the proxy of the default config will be loaded and sometimes cause issues
SPARKLIS_LINK = SPARKLIS_FILE + "?title=custom&endpoint=" + SPARQL_ENDPOINT