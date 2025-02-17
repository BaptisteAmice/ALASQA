import os
import benchmark_extraction
script_dir = os.path.dirname(os.path.realpath(__file__))

# FILE TO BE MODIFIED BY THE USER

# Location of the Sparklis file (local or remote)
sparklis_file = "http://127.0.0.1:8000/static/osparklis.html"

# User agent for the simulated browser (to avoid being blocked)
user_agent = 'SparklisLLM/0.1 ; baptiste.amice@irisa.fr'

# Output folder
output_folder = script_dir + '/Outputs/'

####### 

# Input json file containing the benchmark
#benchmark_file = script_dir + '/Inputs/' + 'Mintaka2.json' #todo
benchmark_file = script_dir + '/Inputs/' + 'qald3_10.json'

# Benchmark name and tested system
benchmark_name = benchmark_extraction.QALD10 #todo
#tested_system = 'dummy' #todo
tested_system = 'sparklisllm'

# SPARQL endpoint
#endpoint = 'https://dbpedia.org/sparql' #todo
endpoint = 'https://query.wikidata.org/sparql'
#endpoint = 'https://skynet.coypu.org/wikidata/'