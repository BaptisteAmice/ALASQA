import json
import logging
import datetime
import os
from SPARQLWrapper import SPARQLWrapper, JSON
import requests
import benchmark_extraction
from test_system import TestSystem, testSystemFactory
import config

#todo changer les lists des types par des tuples

ERROR_PREFIX = "Error: "

def main(benchmark_file: str, benchmark_name: str, tested_system_name: str, endpoint: str, used_llm: str):
    """
    Evaluation of a system on a benchmark, based on the configuration in config.py.
    """
    logging.info('########## System evaluation Start ##########')

    #This part is only done one time
    now = datetime.datetime.now()
    filename = benchmark_name+'_'+tested_system_name+'_'+now.strftime('%Y%m%d_%H%M%S')+'.json'
    meta: dict = metadata(benchmark_name, tested_system_name, endpoint, used_llm)
    questions_ids, questions, benchmark_queries = extract_benchmark(benchmark_file, benchmark_name)

    # Create the system object
    system: TestSystem = testSystemFactory(tested_system_name)


    # Initialize empty lists to accumulate results
    all_system_queries, all_errors, all_reasonings = [], [], []
    all_benchmark_results, all_system_results = [], []
    all_precisions, all_recalls, all_f1_scores = [], [], []

    # Process in batches (to save incrementally the results in case of crash)
    batch_size = config.BATCH_SIZE
    for i in range(0, len(questions), batch_size):
        batch_questions = questions[i:i + batch_size]
        batch_question_ids = questions_ids[i:i + batch_size]
        batch_benchmark_queries = benchmark_queries[i:i + batch_size]

        batch_system_queries, batch_errors, batch_reasonings = system_queries_generation(batch_questions, system, endpoint)
        batch_benchmark_results, batch_system_results, batch_errors = queries_evaluation(
            batch_benchmark_queries, batch_system_queries, batch_errors, endpoint
        )
        batch_precisions, batch_recalls, batch_f1_scores = stats_calculation(batch_benchmark_results, batch_system_results)
        
        # Append batch results to global lists
        all_system_queries.extend(batch_system_queries)
        all_errors.extend(batch_errors)
        all_reasonings.extend(batch_reasonings)
        all_benchmark_results.extend(batch_benchmark_results)
        all_system_results.extend(batch_system_results)
        all_precisions.extend(batch_precisions)
        all_recalls.extend(batch_recalls)
        all_f1_scores.extend(batch_f1_scores)

        # Rewrite the file after each batch
        data = make_dict(meta, questions_ids[: len(all_system_queries)], questions[: len(all_system_queries)], 
                         benchmark_queries[: len(all_system_queries)], all_system_queries, 
                         all_benchmark_results, all_system_results, all_errors, all_reasonings,
                         all_precisions, all_recalls, all_f1_scores)
        
        os.makedirs(config.OUTPUT_FOLDER, exist_ok=True)  # Ensure the directory exists
        with open(config.OUTPUT_FOLDER + filename, 'w') as file:
            json.dump(data, file, indent=4)
        
        logging.info(f'Batch {i} done')

        #close the system
        system.end_system()

    logging.info('########## System evaluation End ##########')


def metadata(benchmark_name: str, tested_system_name: str, endpoint: str, used_llm: str) -> dict:
    """
    Create a metadata dictionary.
    """
    logging.info('Creation and metadata Start')
    return {
        'BenchmarkName' : benchmark_name,
        'TestedSystem' : tested_system_name,
        'Date' : datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'Endpoint' : endpoint,
        'UsedLLM' : used_llm
    }

def extract_benchmark(benchmark_file: str, benchmark_name: str) -> list:
    """
    Extract benchmark data.
    """
    logging.info('Benchmark extraction Start')
    extractor = benchmark_extraction.extractorFactory(benchmark_name)
    return extractor.extractData(benchmark_file)

def system_queries_generation(questions: list, system: TestSystem, endpoint_sparql: str) -> tuple[list, list]:
    """
    Use the tested system and SPARQL endpoint to generate queries for the given questions.
    """
    logging.info('System queries generation Start')
    queries = []
    errors = []
    reasonings = []
    for question in questions:
        query, error, reasoning = system.create_query(question, endpoint_sparql)
        queries.append(query)
        errors.append(error)
        reasonings.append(reasoning)
    return queries, errors, reasonings

def queries_evaluation(benchmark_queries: list, system_queries: list, errors: list, endpoint: str) -> tuple[list, list, list]:
    """
    Execute the benchmark and system queries on the SPARQL endpoint and return the results.
    """
    logging.info('Queries evaluation Start')
    user_agent = config.USER_AGENT # Without it we get 403 error from Wikidata after a few queries
    sparql = SPARQLWrapper(endpoint, agent=user_agent)
    sparql.setReturnFormat(JSON)
    logging.info('Wrapper set')
    benchmark_results = []
    system_results = []
    for i, (b_query, s_query) in enumerate(zip(benchmark_queries, system_queries)):
        # Execute benchmark query
        benchmark_result, benchmark_error = execute_query(sparql, b_query, i, 'Benchmark')
        benchmark_results.append(benchmark_result)
        errors[i] += benchmark_error
        
        # Execute system query
        if s_query is None or s_query == '':  # Skip system query if it's empty
            system_result, system_error = None, 'Warning: No query to execute;'
        else:
            system_result, system_error = execute_query(sparql, s_query, i, 'System')

        system_results.append(system_result)
        errors[i] += system_error
                
        logging.info(f'Query {i} evaluated')
    return benchmark_results, system_results, errors

def execute_query(sparql, query: str, query_index: int, query_type: str) -> tuple:
    """
    Executes a SPARQL query with retry logic on 429 errors and handles both SELECT and ASK queries.
    """
    while True:
        try:
            sparql.setQuery(query)
            result = sparql.query().convert()
            
            if "boolean" in result:  # ASK Query
                return result["boolean"], ""
            elif "results" in result and "bindings" in result["results"]:  # SELECT Query
                return result["results"]["bindings"], ""
            else:
                logging.error(f"Unexpected response format for query {query_index} ({query_type}): {result}")
                return None, ERROR_PREFIX + "Unexpected response format."

        except Exception as e:
            if "429" in str(e):  # Detect 429 Too Many Requests
                retry_after = int(e.headers.get("Retry-After", 5))  # Default to 5 seconds
                logging.warning(f"Query {query_index} ({query_type}) hit 429 Too Many Requests. Retrying after {retry_after} seconds.")
                datetime.time.sleep(retry_after)
            else:
                logging.error(f"Error executing query {query_index} ({query_type}): {e}")
                return None, ERROR_PREFIX + query_type + " query execution failed."
            
def recursive_dict_extract(obj: dict, key_name: str) -> list:
    """
    Recursively extract values from a dictionary based on a key name.
    """
    values = []
    if isinstance(obj, dict):
        for key, val in obj.items():
            if key == key_name:
                values.append(val)
            values.extend(recursive_dict_extract(val, key_name))  # Extend with results from recursion
    elif isinstance(obj, list):
        for item in obj:
            values.extend(recursive_dict_extract(item, key_name))  # Handle lists as well
    return values

def stats_calculation(benchmark_results: list, system_results: list) -> tuple[list, list, list]:
    """
    Calculate precision, recall and F1 score for each question
    """
    logging.info('Stats calculation Start')
    precisions = []
    recalls = []
    f1_scores = []
    for i in range(len(benchmark_results)): #todo cas pas de prédiction (system ou benchmark) -> les compter et pas les prendre en compte?
        benchmark_list = []
        system_list = []
        if benchmark_results[i] is not None:
            if isinstance(benchmark_results[i], bool):  # Handle ASK query
                benchmark_list = [benchmark_results[i]]
            elif isinstance(benchmark_results[i], list) and len(benchmark_results[i]) > 0:  # Handle SELECT query
                benchmark_list = recursive_dict_extract(benchmark_results[i], 'value')

        if system_results[i] is not None:
            if isinstance(system_results[i], bool):  # Handle ASK query
                system_list = [system_results[i]]
            elif isinstance(system_results[i], list) and len(system_results[i]) > 0:  # Handle SELECT query
                system_list = recursive_dict_extract(system_results[i], 'value')

        if len(benchmark_list) > 0 and len(system_list) > 0:
            #todo recheck tt ca
            intersection = []
            try:
                intersection = [d for d in benchmark_list if d in system_list]
            except:
                logging.error("Error in intersection.") # if this error is raised, this function should be reviewed
            precisions.append(len(intersection) / len(system_list))
            recalls.append(len(intersection) / len(benchmark_list))
            f1_scores.append(2 * len(intersection) / (len(benchmark_list) + len(system_list)))
        elif len(benchmark_list) == 0: # If the benchmark has no results, we don't consider the question
            precisions.append(None)
            recalls.append(None)
            f1_scores.append(None)
        elif len(system_list) == 0: # If the system has no results, the precision and recall are 0
            precisions.append(0)
            recalls.append(0)
            f1_scores.append(0)
    return precisions, recalls, f1_scores

def make_dict(meta: dict, questions_ids: list, questions: list, benchmark_queries: list, system_queries: list, benchmark_results: list, system_results: list, errors: list, reasoning: list, precisions: list, recalls: list, f1_scores: list) -> dict:
    """
    Create a dictionary with all the data.
    Also calculate the stats.
    """
    logging.info('Make dict Start')
    stats = {}
    valid_precisions = [p for p in precisions if p is not None]
    valid_recalls = [r for r in recalls if r is not None]
    valid_f1_scores = [f for f in f1_scores if f is not None]
    stats['NbQuestions'] = len(questions_ids)
    stats['NbValidQuestions'] = min(len(valid_precisions), len(valid_recalls), len(valid_f1_scores)) #todo better name
    #todo classifier questions booléennes (résultat booléen pour le benchmark)
    if len(valid_precisions) > 0:
        stats['MeanPrecision']  = sum(valid_precisions) / len(valid_precisions)
        stats['MeanRecall'] = sum(valid_recalls) / len(valid_recalls)
        stats['MeanF1Score'] = sum(valid_f1_scores) / len(valid_f1_scores)
    else:
        stats['MeanPrecision']  = None
        stats['MeanRecall'] = None
        stats['MeanF1Score'] = None

    data = {}
    for i in range(len(questions_ids)):
        data[questions_ids[i]] = {
            'Question' : questions[i],
            **({'Error': errors[i]} if errors[i] != '' else {}), # only add if it's not an empty string
            'Precision' : precisions[i],
            'Recall' : recalls[i],
            'F1Score' : f1_scores[i],
            'BenchmarkQuery' : benchmark_queries[i],
            'SystemQuery' : system_queries[i],
            'BenchmarkResult' : benchmark_results[i],
            'SystemResult' : system_results[i],
            'Reasoning' : reasoning[i]
        }
    return {**meta, 'Stats' : stats, 'Data' : data}

def getModelName(model_api):
    """
    Get the name of the used LLM model from the model API.
    """
    try:
        response = requests.get(model_api)
        response.raise_for_status()  # Raise an error for bad responses (4xx and 5xx)
        data = response.json()  # Convert response to JSON
        model_name = data["data"][0]["id"]
        return model_name
    except requests.exceptions.RequestException as e:
        logging.error("Failed to retrieve the LLM model name. The model may be unavailable, or the API endpoint could be incorrect.")
        exit(1)

def is_file_available(file_url: str) -> bool:
    """
    Checks if a file is available either locally or over the network.
    
    - If it's a local file path, it checks if the file exists.
    - If it's a URL, it sends a request to verify availability.
    
    Returns:
        bool: True if the file is accessible, False otherwise.
    """
    if file_url.startswith("http://") or file_url.startswith("https://"):
        try:
            response = requests.head(file_url, timeout=5)
            return response.status_code == 200
        except requests.RequestException:
            return False
    else:
        return os.path.exists(file_url)

if __name__ == "__main__":
    # Test that the files are available (local or remote)
    logging.info("Benchmark file: " + config.BENCHMARK_FILE)
    if not is_file_available(config.BENCHMARK_FILE):
        logging.error(f"Benchmark file '{config.BENCHMARK_FILE}' is not available.")
        exit(1)
    logging.info("Sparklis file: " + config.SPARKLIS_FILE)
    if not is_file_available(config.SPARKLIS_FILE):
        logging.error(f"Sparklis file '{config.SPARKLIS_FILE}' is not available.")
        exit(1)

    logging.info("SPARQL endpoint: " + config.SPARQL_ENDPOINT)
    #todo tester sparql_endpoint

    # Get the name of the used LLM model
    used_llm = getModelName(config.LLM_API_MODEL)
    logging.info(f"Used LLM model: {used_llm}")

    # Start the evaluation
    main(config.BENCHMARK_FILE, config.BENCHMARK_NAME, config.TESTED_SYSTEM, 
         config.SPARQL_ENDPOINT, used_llm)
