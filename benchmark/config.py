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

# time constraints
SYSTEM_TIMEOUT = 500

# Number of queries executed between each save for a benchmark evaluation
BATCH_SIZE = 10

# Location of the Sparklis file (local or remote)
SPARKLIS_FILE = "http://localhost:8000/static/osparklis.html"

# Location of the LLM API
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
BENCHMARK_FILE = script_dir + '/Inputs/' + 'qald3_10.json'

# Benchmark name and tested system
BENCHMARK_NAME = benchmark_extraction.QALD10 #todo

# Name of the tested system
TESTED_SYSTEM = 'sparklisllm' # dummy | sparklisllm

# SPARQL endpoint, only used in scripts and not by the API
#SPARQL_ENDPOINT = 'https://dbpedia.org/sparql' #todo
SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
#SPARQL_ENDPOINT = 'https://skynet.coypu.org/wikidata/'
#SPARQL_ENDPOINT = 'invalid/endpoint' #todo erreur specifique?