from abc import abstractmethod
import json

# Names of the benchmarks
MINTAKA1K = 'Mintaka1k_final'
QALD10 = 'QALD-10'
QALD9_PLUS = 'QALD-9-plus'

# to extract only boolean questions
ONLY_BOOLEANS = True 

class Extractor:
    """
    Abstract class for extracting data from a benchmark file.
    """
    @abstractmethod
    def extractData(self) -> list[list]:
        pass


def trim_request(request: str) -> str: #todo doesn't work for mintaka #neigher for wikidata
    """
    Removes unnecessary characters from a SPARQL request.
    """
    #todo seems to do nothing, ensure it is needed and how to do it
    request = request.replace('\\"', '"') # Replace \" with ", useful for QALD-10 and Mintaka1k
    return request


#####################################


class ExtractorMintaka:
    """
    Extracts data from the Mintaka1k benchmark
    """
    def extractData(self, file_name: str) -> list[list]:
        with open(file_name, 'r') as file:
            data = json.load(file)
    
        ids = []
        questions = []
        sparql_requests = [] 
            
        for item in data:
            ids.append(item['ID'])
            questions.append(item['Question'])
            request = item['Sparql ID based']
            request_trimmed = trim_request(request)
            sparql_requests.append(request_trimmed)
        return [ids, questions, sparql_requests]
    

class ExtractorQald:
    """
    Extracts data from the QALD-10 benchmark
    """
    def extractData(self, file_name: str) -> list[list]:
        with open(file_name, encoding='utf-8') as file:
            data = json.load(file)
        ids = []
        questions = []
        sparql_requests = [] 
        for item in data["questions"]:
            if (not ONLY_BOOLEANS) or ("boolean" in item['answers'][0]):
                ids.append(item['id'])
                # Find the English question
                english_question = None
                for q in item["question"]:
                    if q["language"] == "en":
                        english_question = q["string"]
                        break  # Stop searching once found
                questions.append(english_question)
                request = item['query']['sparql']
                request_trimmed = trim_request(request)
                sparql_requests.append(request_trimmed)
        return [ids, questions, sparql_requests]



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



        