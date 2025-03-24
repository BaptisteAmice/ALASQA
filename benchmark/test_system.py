from abc import abstractmethod
import interactions
import config
class TestSystem:
    """
    Abstract class for a tested system.
    A system is used to create queries from questions and endpoints.
    """
    def __init__(self, system_name: str):
        self.system_name = system_name

    def create_query(self, question: str, endpoint: str) -> tuple[str, str, str, str]:
        """
        Create a query from a question and an endpoint.
        If an error occurs, it is returned as a string in the second element of the tuple.
        """
        try:
            response, error, steps_status, reasoning = self.create_query_body(question, endpoint)
        except Exception as e:
            response = ""
            error = "Error: please try to intercept the error before." + str(e)
            reasoning = ""
            steps_status = ""
        return response, error, steps_status, reasoning

    @abstractmethod
    def create_query_body(self, question: str, endpoint: str) -> tuple[str, str, str, str]:
        """
        Logic to create a query from a question and an endpoint.
        """
        pass

    @abstractmethod
    def end_system(self):
        """
        Close the system if necessary.
        For example, close the browser if it was opened.
        """
        pass

#####################################

class Dummy(TestSystem):
    def create_query_body(self, question: str, endpoint: str) -> tuple[str, str, str, str]:
        return 'SELECT ?s WHERE { ?s <http://example.com/nonexistentPredicate> ?o.}', 'Error: dummy', '', ''
    
    def end_system(self):
        pass


class Sparklisllm(TestSystem):
    # (static variable) allow to keep the same driver for all requests of a benchmark
    used_driver = None

    def create_query_body(self, question: str, endpoint: str) -> tuple[str, str, str, str]:
        response, error, steps_status, reasoning, driver = interactions.simulated_user(
            config.SPARKLIS_FILE,
            lambda driver: interactions.sparklisllm_question(driver, question, endpoint, self.system_name),
            driver=Sparklisllm.used_driver,
        )
        Sparklisllm.used_driver = driver
        return response, error, steps_status, reasoning
    
    def end_system(self):
        # Close the driver (and the page) if it was opened
        if Sparklisllm.used_driver is not None:
            Sparklisllm.used_driver.close()
            Sparklisllm.used_driver = None


#####################################

def testSystemFactory(system_name: str) -> TestSystem:
    """
    Factory method to create a test system.
    """
    if system_name == "dummy":
        return Dummy(system_name)
    elif "sparklisllm" in system_name:
        return Sparklisllm(system_name)
    else:
        raise ValueError('Unknown test system name')
