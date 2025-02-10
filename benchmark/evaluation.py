import logging
import json
import os
import datetime
import benchmark_extraction as extraction
import test_system

script_dir = os.path.dirname(os.path.realpath(__file__))
output_folder = script_dir + '/Outputs/'

def main():
    logging.debug('Evaluation.py Start')

    #inputs
    benchmark_name = extraction.mintaka1k #todo
    tested_system = 'dummy' #todo
    file = script_dir + '/Inputs/' + 'Mintaka1k_final.json' #todo

    #extract data from benchmark file
    extractor = extraction.extractorFactory(benchmark_name)
    ids, questions, ground_truths = extractor.extractData(file)

    #get system answers
    system_answers = test_system.dummy(ids) #todo
    
    #evaluate
    data = evaluation(ids, questions, ground_truths, system_answers)
    
    #stats
    stats = statistics(data)

    #create file with results
    details = metadata(benchmark_name, tested_system) 
    results = {**details,'Stats' : stats, 'Data' : data}
    now = datetime.datetime.now()
    filename = benchmark_name+'_'+tested_system+'_'+now.strftime('%Y%m%d_%H%M%S')+'.json'
    with open(output_folder+filename, 'w') as file:
        json.dump(results, file, indent=4)

    logging.debug('Evaluation.py End')

def metadata(benchmark_name: str, tested_system: str):
    return {
        'BenchmarkName' : benchmark_name,
        'TestedSystem' : tested_system,
        'Date' : datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    

def evaluation(ids: list, questions: dict, ground_truths: dict,system_answers:dict) -> dict:
    logging.debug('Start of evaluation')
    results = {}
    for id in ids:
        is_correct = ground_truths[id] == system_answers[id]
        results[id] = { 
            'Question' : questions[id], 
            'GroundTruth' : ground_truths[id], 
            'SystemAnswer' : system_answers[id],
            'Correct' : is_correct
        }

    return results

def statistics(data: dict) -> dict:
    return {} #todo

if __name__ == "__main__":
    main()