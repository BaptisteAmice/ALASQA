import json
import logging
import datetime
import os
from SPARQLWrapper import SPARQLWrapper, JSON
import requests
import benchmark_extraction
import test_system
from test_system import TestSystem, testSystemFactory
import config

#todo changer les lists des types par des tuples

ERROR_PREFIX = "Error: "

def main(benchmark_file: str, benchmark_name: str, tested_system_name: str, endpoint: str, used_llm: str):
    """
    Evaluation of a system on a benchmark, based on the configuration in config.py
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
    all_system_queries, all_errors = [], []
    all_benchmark_results, all_system_results = [], []
    all_precisions, all_recalls, all_f1_scores = [], [], []

    # Process in batches (to save incrementally the results in case of crash)
    batch_size = config.BATCH_SIZE
    for i in range(0, len(questions), batch_size):
        batch_questions = questions[i:i + batch_size]
        batch_question_ids = questions_ids[i:i + batch_size]
        batch_benchmark_queries = benchmark_queries[i:i + batch_size]

        batch_system_queries, batch_errors = system_queries_generation(batch_questions, system, endpoint)
        batch_benchmark_results, batch_system_results, batch_errors = queries_evaluation(
            batch_benchmark_queries, batch_system_queries, batch_errors, endpoint
        )
        batch_precisions, batch_recalls, batch_f1_scores = stats_calculation(batch_benchmark_results, batch_system_results)
        
        # Append batch results to global lists
        all_system_queries.extend(batch_system_queries)
        all_errors.extend(batch_errors)
        all_benchmark_results.extend(batch_benchmark_results)
        all_system_results.extend(batch_system_results)
        all_precisions.extend(batch_precisions)
        all_recalls.extend(batch_recalls)
        all_f1_scores.extend(batch_f1_scores)

        # Rewrite the file after each batch
        data = make_dict(meta, questions_ids[: len(all_system_queries)], questions[: len(all_system_queries)], 
                         benchmark_queries[: len(all_system_queries)], all_system_queries, 
                         all_benchmark_results, all_system_results, all_errors, 
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
    Create a metadata dictionary
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
    Extract benchmark data
    """
    logging.info('Benchmark extraction Start')
    extractor = benchmark_extraction.extractorFactory(benchmark_name)
    return extractor.extractData(benchmark_file)

def system_queries_generation(questions: list, system: TestSystem, endpoint_sparql: str) -> tuple[list, list]:
    logging.info('System queries generation Start')
    queries = []
    errors = []
    for question in questions:
        query, error = system.create_query(question, endpoint_sparql)
        queries.append(query)
        errors.append(error)
    return queries, errors

def queries_evaluation(benchmark_queries: list, system_queries: list, errors: list, endpoint: str) -> tuple[list, list, list]:
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
        system_result, system_error = execute_query(sparql, s_query, i, 'System')
        system_results.append(system_result)
        errors[i] += system_error
                
        logging.info(f'Query {i} evaluated')
    return benchmark_results, system_results, errors

def execute_query(sparql, query, query_index, query_type) -> tuple[list, str]:
    """Executes a SPARQL query with retry logic on 429 errors."""
    while True:
        try:
            sparql.setQuery(query)
            return sparql.query().convert()["results"]["bindings"], ""
        except Exception as e:
            if "429" in str(e):  # Detect 429 error
                retry_after = int(e.headers.get("Retry-After", 5))  # Default to 5 seconds
                logging.warning(f"Query {query_index} ({query_type}) hit 429 Too Many Requests. Retrying after {retry_after} seconds.")
                datetime.time.sleep(retry_after)
            else:
                logging.error(f"Error executing query {query_index} ({query_type}): {e}")
                return None, ERROR_PREFIX + query_type + " query execution failed."

def stats_calculation(benchmark_results: list, system_results: list) -> list:
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
        print(benchmark_results[i])
        #test if not of type none and if len >0
        if (not benchmark_results[i] is None) and len(benchmark_results[i]) > 0: 
            benchmark_list = [result['result']['value'] if 'result' in result else result for result in benchmark_results[i]]
        if (not system_results[i] is None) and len(system_results[i]) > 0:
            system_list = [result['result']['value'] if 'result' in result else result for result in system_results[i]]
        if len(benchmark_list) > 0 and len(system_list) > 0: #todo separate and put to 0 for system
            #todo recheck tt ca
            #intersection = len(set(benchmark_list) & set(system_list))
            intersection = []
            try:
                intersection = [d for d in benchmark_list if d in system_list]
            except:
                print("Error in intersection") #todo revoir intersection
            precisions.append(len(intersection) / len(system_list))
            recalls.append(len(intersection) / len(benchmark_list))
            f1_scores.append(2 * len(intersection) / (len(benchmark_list) + len(system_list)))
        else:
            precisions.append(None)
            recalls.append(None)
            f1_scores.append(None)
    return precisions, recalls, f1_scores

def make_dict(meta: dict, questions_ids: list, questions: list, benchmark_queries: list, system_queries: list, benchmark_results: list, system_results: list, errors: list, precisions: list, recalls: list, f1_scores: list) -> dict:
    """
    Create a dictionary with all the data
    """
    logging.info('Make dict Start')
    stats = {}
    valid_precisions = [p for p in precisions if p is not None]
    valid_recalls = [r for r in recalls if r is not None]
    valid_f1_scores = [f for f in f1_scores if f is not None]
    stats['NbQuestions'] = len(questions_ids)
    stats['NbValidQuestions'] = min(len(valid_precisions), len(valid_recalls), len(valid_f1_scores))
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
            'SystemResult' : system_results[i]
        }
    return {**meta, 'Stats' : stats, 'Data' : data}

def getModelName(model_api):
    """
    Get the name of the used LLM model from the model API
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
