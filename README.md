# LLMAugmentedSparklisQA

todo

## Description


## Installation
#todo used browser and its version

launch a local llm
    (in our case) mistral-nemo-instruct-2407
set llm api in llm_utils.js and in benchmark/config.py

if just want to interact with interface : open html file in browser or launch a server

for api and benchmarking: 
venv requirements.txt
check the config.py file
### api
if want to use api:
launch the server

### benchmark
launch the server: fastapi dev api.py

selenium
might need Drivers in the path (for browser)(https://selenium-python.readthedocs.io/installation.html#drivers)

## Usage
launch a local llm accessible through an api

launch the api (or you can just open the html if you want to just use it manually)
fastapi dev api.py
(if virtual env not activated : source .venv/bin/activate)

lm studio
use gpu (vulkan for example)


to test text2sparql script you have to host graphes locally 
for example with fuseki create
http://localhost:3030/corporate/sparql
and 
http://localhost:3030/dbpedia/sparql

fuseki doc:
https://jena.apache.org/documentation/fuseki2/

then expose for example with tailscale 
tailscale funnel 8000

.\fuseki-server.bat (on windows)
(needs https to be callable)
tailscale funnel --https 3131 3030


## License
For open source projects, say how it is licensed.

(todo check licenses selenium, etc.)
