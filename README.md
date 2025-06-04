# Spark-QA: LLM-augmented Sparklis for QA 

## Description

This repository contains an extension of Sparklis that integrates a Large Language Model (LLM) to generate SPARQL queries from natural language questions. The LLM extension is based on a command extension of Sparklis, which allows navigation of knowledge graphs using command chains instead of the graphical interface.

## Installation

This system has been tested on Linux and Windows, in Firefox and Brave (a chrome-based browser) with LM Studio (between versions 0.3.9 and 0.3.14).

To ensure the system works correctly, an LLM must be available through an API. The system has been tested with mistral-nemo-instruct-2407 hosted thanks to LM Studio and accessible through an OpenAI-like API. You will need to update the LLM endpoint URL in both `llm_utils.js` and `benchmark/config.py` to match your local API address.

If you just want to use the interface, you can just open the html file in your browser. If you want to use the API or run benchmarks, you will need to install the Python dependencies.

It is recommended to use a virtual environment (venv) or conda to install the dependencies.
To create the virtual environment, use the requirements.txt file.
If you want to use conda, you can use the file environment.yml.
```bash
conda env create --file=environment.yml
conda activate llm-sparklis-env
```

You may need to install Drivers for the browser you are using in order for Selenium to work correctly. You can find the documentation for the drivers here: https://selenium-python.readthedocs.io/installation.html#drivers

You will need to check and update the config.py file in the benchmark folder to set different parameters (like the LLM endpoint, the SPARQL endpoint for benchmark runs, etc.).

### API

If you want to use the API, you will need to run the server. You can use the file api.py to run the server. You can use the command below to run the server:
```bash
fastapi run .\benchmark\api.py  
```
By default, the server runs on port 8000.
You will find the API documentation at http://localhost:8000/docs.
You can also find the hosted Sparklis files used by the API at http://localhost:8000/static/osparklis.html.

The API only accepts 2 endpoints designed by the identifiers https://text2sparql.aksw.org/2025/dbpedia/ and https://text2sparql.aksw.org/2025/corporate/. You can update the corresponding SPARQL endpoints in the api.py file.

### Benchmark

By launching the API before the benchmark, you won't have to update the location of osparklis.html in the config.py file and will be using the same version of Sparklis as the one used in the API.
You can run the benchmark with the command below:
```bash
python benchmark/system_evaluation.py
```

A PDF containing plots can then be generated using the resulting JSON file as input
through:
```bash
python benchmark/post_process.py
```

# Text2Sparql

You can also use Text2SPARQL'25 YML files to run benchmarks through the API.
`translator_qald_to_text2sparql.py` can convert QALD JSON files to Text2SPARQL YAML files.


You may want to host graphs locally to run the benchmarks.
For that, you can for example use Fuseki2 to create the endpoints (https://jena.apache.org/documentation/fuseki2/).


If you want to simply expose such a server to the internet, you can use tools such as Tailscale.
To expose the API:
```bash
tailscale funnel 8000
```
To expose the graphs (an easy way to obtain the required SSL certificates):
```bash
tailscale funnel --https 3131 3030
```

# Remarks

- You can implement new systems by adding classes in the file llm_extension_any_system.js. The tools for post-processing are already available, but only used in systems after the "EXPERIMENTAL SYSTEMS" comment. As the name suggests, these systems are experimental and have yet to be validated.

- You can have bad results with DBpedia because of CORS.
A solution is to use a dump locally hosted or to use a proxy endpoint.
For the latter, it can make some queries fail because the queries are encapsulated in a SERVICE.

- Allowing the LLM to choose the direction of a property makes focus management more difficult.

- The groupBy commands have 2 alternative either in Sparklis or in post-processing.
- "before" and "after" commands compare string values rather than dates, which can lead to issues, especially with negative dates.

## License

License: Apache Licence 2.0