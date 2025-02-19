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

    @abstractmethod
    def end_system(self):
        pass

#####################################

class Dummy(TestSystem):
    def create_query_body(self, question: str, endpoint: str) -> tuple[str, str]:
        return 'SELECT ?s WHERE { ?s <http://example.com/nonexistentPredicate> ?o.}', 'Error: dummy'
    
    def end_system(self):
        pass


class Sparklisllm(TestSystem):
    # (static variable) allow to keep the same driver for all requests of a benchmark
    used_driver = None

    def create_query_body(self, question: str, endpoint: str) -> tuple[str, str]:
        response, error, driver = interactions.simulated_user(
            config.SPARKLIS_FILE,
            lambda driver: interactions.sparklisllm_question(driver, question, endpoint),
            driver=Sparklisllm.used_driver,
        )
        Sparklisllm.used_driver = driver
        return response, error
    
    def end_system(self):
        # Close the driver (and the page) if it was opened
        if Sparklisllm.used_driver is not None:
            Sparklisllm.used_driver.close()
            Sparklisllm.used_driver = None


#####################################

def testSystemFactory(benchmark_name: str) -> TestSystem:
    if benchmark_name == "dummy":
        return Dummy()
    elif benchmark_name == "sparklisllm":
        return Sparklisllm()
    else:
        raise ValueError('Unknown test system name')
