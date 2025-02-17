from abc import abstractmethod
import interactions
import config
class TestSystem:
    @abstractmethod
    def create_query(self, question: str, endpoint: str) -> str:
        pass

#####################################

class Dummy(TestSystem):
    def create_query(self, question: str, endpoint: str) -> str:
        return 'SELECT ?s WHERE { ?s <http://example.com/nonexistentPredicate> ?o.}'


class Sparklisllm(TestSystem):
    def create_query(self, question: str, endpoint: str) -> str:
        response = interactions.simulated_user(
            config.sparklis_file,
            lambda driver: interactions.sparklisllm_question(driver, question, endpoint)
        )
        return response


#####################################

def TestSystemFactory(benchmark_name: str) -> TestSystem:
    if benchmark_name == "dummy":
        return Dummy()
    elif benchmark_name == "sparklisllm":
        return Sparklisllm()
    else:
        raise ValueError('Unknown test system name')
