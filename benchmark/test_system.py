from abc import abstractmethod
import interactions
import config
class TestSystem:
    def create_query(self, question: str, endpoint: str) -> tuple[str, str]:
        try:
            response, error = self.create_query_body(question, endpoint)
        except Exception as e:
            response = ""
            error = "Error: please try to intercept the error before." + str(e)
        return response, error

    @abstractmethod
    def create_query_body(self, question: str, endpoint: str) -> tuple[str, str]:
        pass

#####################################

class Dummy(TestSystem):
    def create_query_body(self, question: str, endpoint: str) -> tuple[str, str]:
        return 'SELECT ?s WHERE { ?s <http://example.com/nonexistentPredicate> ?o.}', 'Error: dummy'


class Sparklisllm(TestSystem):
    def create_query_body(self, question: str, endpoint: str) -> tuple[str, str]:
        response, error = interactions.simulated_user(
            config.SPARKLIS_FILE,
            lambda driver: interactions.sparklisllm_question(driver, question, endpoint)
        )
        return response, error


#####################################

def TestSystemFactory(benchmark_name: str) -> TestSystem:
    if benchmark_name == "dummy":
        return Dummy()
    elif benchmark_name == "sparklisllm":
        return Sparklisllm()
    else:
        raise ValueError('Unknown test system name')
