import os
import benchmark_extraction
script_dir = os.path.dirname(os.path.realpath(__file__))

# FILE TO BE MODIFIED BY THE USER

# Location of the Sparklis file (local or remote)
SPARKLIS_FILE = "http://127.0.0.1:8000/static/osparklis.html"

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
TESTED_SYSTEM = 'sparklisllm'

# SPARQL endpoint, only used in scripts and not by the API
#SPARQL_ENDPOINT = 'https://dbpedia.org/sparql' #todo
SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
#SPARQL_ENDPOINT = 'https://skynet.coypu.org/wikidata/'