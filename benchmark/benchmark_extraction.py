from abc import abstractmethod
import json

# Names of the benchmarks
MINTAKA1K = 'Mintaka1k_final'
QALD10 = 'QALD-10'
QALD9_PLUS = 'QALD-9-plus'

# to extract only boolean questions
ONLY_BOOLEANS = False 

class Extractor:
    """
    Abstract class for extracting data from a benchmark file.
    """
    @abstractmethod
    def extractData(self, file_name: str, language: str, extraction_filter: dict) -> list[list]:
        pass


def trim_request(request: str) -> str: #todo doesn't work for mintaka #neigher for wikidata
    """
    Removes unnecessary characters from a SPARQL request.
    """
    #todo seems to do nothing, ensure it is needed and how to do it
    request = request.replace('\\"', '"') # Replace \" with ", useful for QALD-10 and Mintaka1k
    return request


#####################################


class ExtractorMintaka: #todo update for language and for filter, and for tags
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
            request_trimmed = trim_request(request)
            sparql_requests.append(request_trimmed)
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
            request_trimmed = trim_request(request)
            sparql_requests.append(request_trimmed)

            tags.append(item.get('tags', []))

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
    else:
        raise ValueError('Unknown benchmark name')



        