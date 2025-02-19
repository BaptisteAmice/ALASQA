import os
import logging
import benchmark_extraction
script_dir = os.path.dirname(os.path.realpath(__file__))

# FILE TO BE MODIFIED BY THE USER

# Logging level
logging.basicConfig(level=logging.INFO) # NOTSET | DEBUG | INFO | WARNING | ERROR | CRITICAL

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

# Input json file containing the benchmark
#benchmark_file = script_dir + '/Inputs/' + 'Mintaka2.json' #todo
BENCHMARK_FILE = script_dir + '/Inputs/' + 'qald3_10.json'

# Benchmark name and tested system
BENCHMARK_NAME = benchmark_extraction.QALD10 #todo
#TESTED_SYSTEM = 'dummy' #todo
TESTED_SYSTEM = 'sparklisllm' # dummy | sparklisllm

# SPARQL endpoint, only used in scripts and not by the API
#SPARQL_ENDPOINT = 'https://dbpedia.org/sparql' #todo
SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
#SPARQL_ENDPOINT = 'https://skynet.coypu.org/wikidata/'
#SPARQL_ENDPOINT = 'invalid/endpoint' #todo erreur specifique?