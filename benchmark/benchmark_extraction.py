from abc import abstractmethod
import json
import logging

MINTAKA1K = 'Mintaka1k_final'
QALD10 = 'QALD-10'

class Extractor:
    """
    Abstract class for extracting data from a benchmark file
    """
    @abstractmethod
    def extractData(self) -> list[list]:
        pass


def trim_request(request: str) -> str: #todo doesn't work for mintaka
    """
    Removes the backslashes from the request
    """
    return request.replace("\\", "")


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
    elif benchmark_name == QALD10:
        return ExtractorQald()
    else:
        raise ValueError('Unknown benchmark name')



        