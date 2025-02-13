import json
import logging
import os
import datetime
from SPARQLWrapper import SPARQLWrapper, JSON
import benchmark_extraction
import test_system

script_dir = os.path.dirname(os.path.realpath(__file__))
output_folder = script_dir + '/Outputs/'

def main(benchmark_file: str, benchmark_name: str, tested_system: str, endpoint: str, used_llm: str):
    logging.debug('System evaluation Start')

    meta: dict = metadata(benchmark_name, tested_system, endpoint, used_llm)
    questions_ids, questions, benchmark_queries = extract_benchmark(benchmark_file, benchmark_name)
    system_queries = system_queries_generation(questions, tested_system)
    benchmark_results, system_results = queries_evaluation(benchmark_queries, system_queries, endpoint)
    precisions, recalls, f1_scores = stats_calculation(benchmark_results, system_results)

    data: dict = make_dict(meta, questions_ids, questions, benchmark_queries, system_queries, benchmark_results, system_results, precisions, recalls, f1_scores)

    now = datetime.datetime.now()
    filename = benchmark_name+'_'+tested_system+'_'+now.strftime('%Y%m%d_%H%M%S')+'.json'
    with open(output_folder+filename, 'w') as file:
        json.dump(data, file, indent=4)

    logging.debug('System evaluation End')


def metadata(benchmark_name: str, tested_system: str, endpoint: str, used_llm: str) -> dict:
    """
    Create metadata dictionary
    """
    logging.debug('Creation and metadata Start')
    return {
        'BenchmarkName' : benchmark_name,
        'TestedSystem' : tested_system,
        'Date' : datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'Endpoint' : endpoint,
        'UsedLLM' : used_llm
    }

def extract_benchmark(benchmark_file: str, benchmark_name: str) -> list:
    """
    Extract benchmark data
    """
    logging.debug('Benchmark extraction Start')
    extractor = benchmark_extraction.extractorFactory(benchmark_name)
    return extractor.extractData(benchmark_file)

def system_queries_generation(questions: list, system_name: str) -> list:
    logging.debug('System queries generation Start')
    system = test_system.TestSystemFactory(system_name)
    return [system.create_query(question) for question in questions]

def queries_evaluation(benchmark_queries: list, system_queries: list, endpoint: str) -> list:
    logging.debug('Queries evaluation Start')
    sparql = SPARQLWrapper(endpoint)  # Instantiate once
    sparql.setReturnFormat(JSON)
    logging.debug('Wrapper set')
    benchmark_results = []
    system_results = []
    for i, (b_query, s_query) in enumerate(zip(benchmark_queries, system_queries)):
        try:
            # Execute benchmark query
            sparql.setQuery(b_query)
            benchmark_results.append(sparql.query().convert()["results"]["bindings"])
            
            # Execute system query
            sparql.setQuery(s_query)
            system_results.append(sparql.query().convert()["results"]["bindings"])
            
            logging.debug(f'Query {i} evaluated')

        except Exception as e:
            logging.error(f"Error executing query {i}: {e}")
            benchmark_results.append(None)
            system_results.append(None)

    return benchmark_results, system_results

def stats_calculation(benchmark_results: list, system_results: list) -> list:
    logging.debug('Stats calculation Start')
    precisions = []
    recalls = []
    f1_scores = []
    for i in range(len(benchmark_results)):
        precisions.append(0) #todo
        recalls.append(0) #todo
        f1_scores.append(0) #todo
    return precisions, recalls, f1_scores

def make_dict(meta: dict, questions_ids: list, questions: list, benchmark_queries: list, system_queries: list, benchmark_results: list, system_results: list, precisions: list, recalls: list, f1_scores: list) -> dict:
    logging.debug('Make dict Start')
    stats = {}
    stats['NbQuestions'] = len(questions_ids)
    stats['MeanPrecision']  = sum(precisions) / len(precisions)
    stats['MeanRecall'] = sum(recalls) / len(recalls)
    stats['MeanF1Score'] = sum(f1_scores) / len(f1_scores)

    data = {}
    for i in range(len(questions_ids)):
        data[questions_ids[i]] = {
            'Question' : questions[i],
            'BenchmarkQuery' : benchmark_queries[i],
            'SystemQuery' : system_queries[i],
            'BenchmarkResult' : benchmark_results[i],
            'SystemResult' : system_results[i],
            'Precision' : precisions[i],
            'Recall' : recalls[i],
            'F1Score' : f1_scores[i]
        }
    return {**meta, 'Stats' : stats, 'Data' : data}

if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG) # DEBUG, INFO, WARNING, ERROR, CRITICAL

    benchmark_file = script_dir + '/Inputs/' + 'Mintaka10.json' #todo
    #benchmark_file = script_dir + '/Inputs/' + 'qald_10.json'
    
    benchmark_name = benchmark_extraction.MINTAKA1K #todo
    tested_system = 'dummy' #todo

    #endpoint = 'https://dbpedia.org/sparql' #todo
    endpoint = 'https://query.wikidata.org/sparql'

    used_llm = 'mistral-nemo-instruct-2407' #todo


    main(benchmark_file, benchmark_name, tested_system, endpoint, used_llm)



# 1. metadata
# Ajout nom jeu de données, système, date, endpoint, used_llm

# 2. benchmark_extraction
# extrait depuis jeu de données 
# id questions
# questions
# BenchmarkSPARQL
# nbre_questions (metadata)

# 3. system_queries_generation
# appel système pour créer SystemSPARQL

# 4. queries_evaluation
# evalue BenchmarkSPARQL et SystemSPARQL

# 5. stats_calculation
# calcul des stats locales
# calcul des stats globales