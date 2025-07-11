"""
This file extract data from benchmark files.
Each benchmark has its own extractor class that implements the Extractor interface.
"""
from abc import abstractmethod
import json
import yaml

# Names of the benchmarks
MINTAKA1K = 'Mintaka1k_final'
QALD10 = 'QALD-10'
QALD9_PLUS = 'QALD-9-plus'
TEXT2SPARQL = 'TEXT2SPARQL'

# to extract only boolean questions
ONLY_BOOLEANS = False 

class Extractor:
    """
    Abstract class for extracting data from a benchmark file.
    """
    @abstractmethod
    def extractData(self, file_name: str, language: str, extraction_filter: dict) -> list[list]:
        pass


#####################################


class ExtractorMintaka: #todo update to take the extraction_filter into account
    """
    Extracts data from the Mintaka1k benchmark
    """
    def extractData(self, file_name: str, language: str, extraction_filter: dict) -> list[list]:
        with open(file_name, 'r') as file:
            data = json.load(file)
    
        ids = []
        questions = []
        sparql_requests = [] 
        tags = []
            
        for item in data:
            ids.append(item['ID'])
            questions.append(item['Question'])
            request = item['Sparql ID based']
            sparql_requests.append(request)
            tags.append(item.get('tags', []))
        return [ids, questions, sparql_requests, tags]
    

class ExtractorQald:
    """
    Extracts data from the QALD-10 benchmark
    """
    def extractData(self, file_name: str, language: str, extraction_filter: dict) -> list[list]:
        with open(file_name, encoding='utf-8') as file:
            data = json.load(file)
        ids = []
        questions = []
        sparql_requests = []
        tags = []
        for item in data["questions"]:
            # Check for boolean type if required
            if ONLY_BOOLEANS and "boolean" not in item["answers"][0]:
                continue

            # Apply all filters from extraction_filter
            passed = True
            for key, condition in extraction_filter.items():
                if key not in item or not condition(item[key]):
                    passed = False
                    break
            if not passed:
                continue

            ids.append(item['id'])

            # Find the language-specific question
            question_in_language = None
            for q in item["question"]:
                if q["language"] == language:
                    question_in_language = q["string"]
                    break

            # Skip if question in desired language not found
            if question_in_language is None:
                continue

            questions.append(question_in_language)

            request = item['query']['sparql']
            sparql_requests.append(request)

            tags.append(item.get('tags', []))

        return [ids, questions, sparql_requests, tags]

class ExtractorText2Sparql:
    """
    Extracts data from a Text2SPARQL-style YAML benchmark file.
    """
    def extractData(self, file_name: str, language: str, extraction_filter: dict) -> list[list]:
        with open(file_name, encoding='utf-8') as file:
            data = yaml.safe_load(file)

        ids = []
        questions = []
        sparql_requests = []
        tags = []  # Optional: you can use features/classes/properties as tags if you want

        for item in data.get("questions", []):
            passed = True
            for key, condition in extraction_filter.items():
                if key not in item or not condition(item[key]):
                    passed = False
                    break
            if not passed:
                continue

            ids.append(item['id'])

            question_in_language = None
            question_data = item.get('question', {})
            if isinstance(question_data, dict):
                question_in_language = question_data.get(language)

            if question_in_language is None:
                continue

            questions.append(question_in_language)

            request = item['query']['sparql']
            sparql_requests.append(request)

            # Example: combine features, classes, properties as tags
            combined_tags = []
            for tag_key in ['features', 'classes', 'properties']:
                combined_tags.extend(item.get(tag_key, []))
            tags.append(combined_tags)

        return [ids, questions, sparql_requests, tags]



#####################################

def extractorFactory(benchmark_name: str) -> Extractor:
    """
    Factory method for creating an Extractor object
    """
    if benchmark_name == MINTAKA1K:
        return ExtractorMintaka()
    elif benchmark_name in (QALD10, QALD9_PLUS):
        return ExtractorQald()
    elif benchmark_name == TEXT2SPARQL:
        return ExtractorText2Sparql()
    else:
        raise ValueError('Unknown benchmark name')
