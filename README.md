# ALASQA: An LLM-Augmented Sparklis for Question-Answering

## Description

This repository contains **ALASQA**, a system integrating Sparklis with Large Language Models (LLMs) to generate SPARQL queries from natural language questions. The integration is based on two complementary extensions: **Sparklis Commands**, an intermediate command language enabling navigation of knowledge graphs via command chains instead of the graphical interface, and **Sparklis LLM**, a module that generates these command sequences from natural language input.

## Results

todo README file includes table of results accompanied by precise command to run to produce those results.

## Folder Structure

- `webapp/`: Contains ALASQA. `osparklis.html` can be opened in a browser to use the interface.
- `benchmark/`: Contains all the tools to evaluate the system, including the API, the benchmark scripts and the post-processing scripts.
    - `BestOutputs/`: Contains the outputs produced by ALASQA with its best system strategies on different benchmarks. The subfolder `for_egc/` contains the outputs for the EGC paper, organized first by benchmark and then by configuration. Each evaluated configuration includes the outputs of three runs and a Markdown table summarizing the results.
    - `Inputs/`: Contains the input files for the benchmarks, including the QALD JSON files and the Text2SPARQL YAML files. The QALD benchmarks include their original JSON files, patched JSON files, and Markdown files summarizing the modifications made between the original and patched files. This directory also contains a script to translate a QALD benchmark to the Text2SPARQL format.
    - `Outputs/`: Will contain the outputs of running the benchmarks.


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

By launching the API before running the benchmark, you won’t need to update the location of `osparklis.html` in the `config.py` file, because you’ll be using the instance hosted by the API at `http://localhost:8000/static/osparklis.html`.
You can run the benchmark with the command below:
```bash
python benchmark/system_evaluation.py
```
Additional notes:
- When using ALASQA manually, parameters such as the LLM endpoint are set in `llm_utils.js` and must be updated manually (allowing to just open the HTML file in a browser without any extra setup).
- However, when running the benchmark, these parameters are automatically overridden by the values defined in config.py, so you only need to set them there (if such value are set to None in the `config.py` file, the default values in `llm_utils.js` will be used).

A PDF containing plots can then be generated using the resulting JSON file as input
through:
```bash
python benchmark/post_process.py
```

# TEXT2SPARQL

You can also use Text2SPARQL'25 YML files to run benchmarks through the API.
`translator_qald_to_text2sparql.py` can convert QALD JSON files to Text2SPARQL YAML files.


You may want to host graphs locally to run the benchmarks.
For that, you can for example use Fuseki2 to create the endpoints (https://jena.apache.org/documentation/fuseki2/).


<!-- If you want to simply expose such a server to the internet, you can use tools such as Tailscale.
To expose the API:
```bash
tailscale funnel 8000
```
To expose the graphs (an easy way to obtain the required SSL certificates):
```bash
tailscale funnel --https 3131 3030
``` -->
