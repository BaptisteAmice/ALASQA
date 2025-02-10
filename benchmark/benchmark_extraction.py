from abc import abstractmethod
import json
import logging

mintaka1k = 'Mintaka1k_final'
qald10 = 'QALD-10'

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
        questions = {}
        ground_truths = {} 
            
        for item in data:
            ids.append(item['ID'])
            questions[item['ID']] = item['Question']
            ground_truths[item['ID']] = item['Sparklis ID based']
        return [ids, questions, ground_truths]
    

class ExtractorQald:
    def extractData(self, file_name: str) -> list[list]:
        with open(file_name, 'r') as file:
            data = json.load(file)
        ids = []
        questions = {}
        ground_truths = {} 
        for item in data:
            #todo
            pass
        return [ids, questions, ground_truths] 



#####################################

def extractorFactory(benchmark_name: str) -> Extractor:
    if benchmark_name == mintaka1k:
        return ExtractorMintaka()
    elif benchmark_name == qald10:
        return ExtractorQald()
    else:
        raise ValueError('Unknown benchmark name')



        