from abc import abstractmethod
import json
import logging

MINTAKA1K = 'Mintaka1k_final'
QALD10 = 'QALD-10'

class Extractor:
    @abstractmethod
    def extractData(self) -> list[list]:
        pass


#####################################


class ExtractorMintaka:
    def extractData(self, file_name: str) -> list[list]:
        with open(file_name, 'r') as file:
            data = json.load(file)
    
        ids = []
        questions = []
        sparql_requests = [] 
            
        for item in data:
            ids.append(item['ID'])
            questions.append(item['Question'])
            sparql_requests.append(item['Sparql ID based'])
        print(ids)
        print(sparql_requests)
        return [ids, questions, sparql_requests]
    

class ExtractorQald:
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
            sparql_requests.append(item['query']['sparql'])
                    
        return [ids, questions, sparql_requests] 



#####################################

def extractorFactory(benchmark_name: str) -> Extractor:
    if benchmark_name == MINTAKA1K:
        return ExtractorMintaka()
    elif benchmark_name == QALD10:
        return ExtractorQald()
    else:
        raise ValueError('Unknown benchmark name')



        