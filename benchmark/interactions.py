"""
Defines functions to interact with web pages using Selenium WebDriver.

This module enables automation of user interactions such as clicking,
typing, navigating, and other browser actions by substituting manual inputs
with programmatic commands executed through Selenium WebDriver.
"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import UnexpectedAlertPresentException, TimeoutException
from selenium.webdriver.support.ui import Select
import logging
import config

def get_new_driver(is_headless:bool=False) -> webdriver.Firefox:
    # Options for the browser
    options = Options()
    if is_headless:
        #options.headless = True #to not open the browser #do not seems to work
        options.add_argument("--headless")  # Run in headless mode
    driver = webdriver.Firefox(options=options)
    return driver

def simulated_user(url: str, interactions, driver: webdriver.Firefox = None) -> tuple[str, str, str, str, webdriver.Firefox]:
    """
    Simulate a given user interaction with a web page.
    If driver is None, a new driver is created.
    If the driver is specified, it is used to interact with the page.
    This allow to open a new page or use an existing one (first one for API requests and second one for benchmarks).
    The driver is returned and should be handled by the caller (for example, closed or reused).
    """
    # Create a new driver if none is provided
    if driver is None:
        driver = get_new_driver(is_headless=config.HIDE_BROWSER_ON_BENCHMARK_EVALUATION)
    driver.get(url)
    result, nl_query, error, steps_status, reasoning = interactions(driver)
    return result, nl_query, error, steps_status, reasoning, driver

def wait_and_handle_alert(driver, timeout: int, end_condition) -> str:
    """
    Wait until the condition is met while dismissing unexpected alerts.
    This function cannot be fully relied upon to prevent a question from crashing the client 
    due to potential incorrect implementations, either on the browser driver side or in Selenium.

    It is preferable to handle alerts directly in JavaScript. However, this function remains useful 
    for preventing the entire testing procedure from crashing.
    """
    errorText : str = ""
    try:
        WebDriverWait(driver, timeout).until(lambda d: 
            end_condition(d)
        )
    except UnexpectedAlertPresentException: 
        # Dismiss the alert and log it to continue waiting
        try:
            alert = driver.switch_to.alert
            alert_text = alert.text
            alert.accept()
            new_error_text = f"Unhandled alert detected and dismissed: {alert_text}"
            logging.warning(new_error_text)
            errorText += new_error_text
        except Exception as e:
            # For exemple useful with wikidata endpoint alerts, that disapear before the alert is read
            new_error_text = "An alert was dismissed before it could be read + " + str(e)
            logging.warning(new_error_text)
            errorText += new_error_text
        # Retry waiting after dismissing the alert (generally the condition is met after the alert)
        errorText += wait_and_handle_alert(driver, timeout, end_condition)  # Retry waiting after dismissing the alert
    except TimeoutException:
        new_error_text = "Timeout while waiting for system response."
        logging.error(new_error_text)
        errorText += new_error_text 
    except Exception as e:
        new_error_text = f"Error while waiting for system response: {e}"
        logging.error(new_error_text)
        errorText += new_error_text 
    return errorText

def getStepsStatus(driver):
    """
    Get the current status of the steps.
    Use the local storage to be resiliet to crashes of the JS script.
    """
    try:
        return driver.execute_script("return localStorage.getItem('steps_status');")
    except Exception as e:
        logging.error(f"Error while getting the steps status: {e}")
        return "Failed to get steps status"

def sparklisllm_question(driver, question, endpoint_sparql, system_name, suggestion_commands_tactic) -> tuple[str, str, str, str]:
    """
    Interaction with the SparklisLLM system to ask a question
    """
    # The errors will be concatenated in this variable
    error = ""
    language = config.LANGUAGE_SPARKLIS
    
    url_extension = ''
    no_caching = True
    no_logging = True
    if no_caching:
        # Caching SPARQL query results (uncheck for frequently changing data)
        url_extension += '&caching=false'
    if no_logging:
        # Reporting query history for usability improvement (only client IP, session ID, and queries are reported, not query results)
        url_extension += '&logging=false'
    if "wikidata" in endpoint_sparql:
        url_extension += '&wikidata_mode=true&entity_lexicon_select=http%3A//www.w3.org/2000/01/rdf-schema%23label&entity_lexicon_lang='+language+'&concept_lexicons_select=http%3A//www.w3.org/2000/01/rdf-schema%23label&concept_lexicons_lang='+language+'&auto-filtering=false'
    if url_extension != '':
        driver.get(driver.current_url + url_extension)

    # Override ALASQAConfig if needed
    override_alasqa_config_script = f"""
    // Assuming getALASQAConfig and setALASQAConfig are already defined on the page
    var temp_config = getALASQAConfig();
    temp_config.api_url = "{config.LLM_API_CHAT_COMPLETIONS}";
    temp_config.nl_post_processing = "{config.NL_POST_PROCESSING}";
    setALASQAConfig(temp_config);
    console.log("Updated ALASQAConfig");
    """
    driver.execute_script(override_alasqa_config_script)

    #deploy llm menu
    llm_menu_button = driver.find_element(by=By.ID, value="chatbot-menu-button")
    llm_menu_button.click()

    # clear all previous messages 
    clear_button = driver.find_element(by=By.ID, value="chatbot-clear-button")
    clear_button.click()

    #select the strategy
    #get the strategy name after "sparklisllm-" in id=strategy-dropdown
    specific_strategy_name = system_name.split("sparklisllm-")[1]    
    # Find the select dropdown element
    dropdown = Select(driver.find_element("id", "strategy-dropdown"))
    # Get all available option texts
    available_options = [option.text for option in dropdown.options]

    # Check if the specific strategy name exists
    if specific_strategy_name in available_options:
        dropdown.select_by_visible_text(specific_strategy_name)
    else:
        logging.error(f"Strategy {specific_strategy_name} not found in the dropdown")

    # Find and select the suggestion commands algorithm (in suggestion-commands-tactic-dropdown)
    # Find the select dropdown element
    dropdown = Select(driver.find_element("id", "suggestion-commands-tactic-dropdown"))
    # Get all available option texts
    available_options = [option.text for option in dropdown.options]
    # Check if the specific tactic name exists
    if suggestion_commands_tactic in available_options:
        dropdown.select_by_visible_text(suggestion_commands_tactic)
    else:
        logging.error(f"Tactic {suggestion_commands_tactic} not found in the dropdown")

    # Locate the text box and send the question
    logging.info(f"INPUT: {question}")
    text_box = driver.find_element(by=By.ID, value="user-input")
    text_box.send_keys(question)
  
    # Submit the question
    input_send_button = driver.find_element(by=By.ID, value="input-send-button")
    input_send_button.click()

    #while the inputs are disabled, we can consider the system is still processing the question
    logging.info("Waiting for system response...")
    error += wait_and_handle_alert(driver, config.SYSTEM_TIMEOUT, 
                                  lambda d: not text_box.get_attribute("disabled"))
    logging.info("System response received.")
    
    # Locate the chatbot-responses-container and find the last chatbot-qa div
    chatbot_qa_elements = driver.find_elements(By.CSS_SELECTOR, "#chatbot-responses-container .chatbot-qa")

    # Get the last chatbot-qa div
    last_chatbot_qa = chatbot_qa_elements[-1]

    # Find the chatbot-reasoning inside the last chatbot-qa div
    chatbot_reasoning = last_chatbot_qa.find_element(By.CLASS_NAME, "chatbot-reasoning")
    # If the reasoning is empty, add a warning
    if chatbot_reasoning.text == "":
        error += "Warning: Empty reasoning from the system;"

    # Find the chatbot-answer inside the last chatbot-qa div
    chatbot_answer = last_chatbot_qa.find_element(By.CLASS_NAME, "chatbot-answer")
    # If the answer is empty, add a warning
    if chatbot_answer.text == "":
        error += "Warning: Empty answer from the system;"

    # Find the sparql-request inside the last chatbot-qa div
    sparql_request = last_chatbot_qa.find_element(By.CLASS_NAME, "sparql-request")
    # If the sparql-request is empty, add a warning
    if sparql_request.text == "":
        error += "Warning: Empty SPARQL request from the system;"

    # Find the sparklis-request inside the last chatbot-qa div
    sparklis_request = last_chatbot_qa.find_element(By.CLASS_NAME, "sparklis-request")
    # If the sparql-request is empty, add a warning
    if sparklis_request.text == "":
        error += "Warning: Empty Sparklis request from the system;"

    # Find the chatbot-errors inside the last chatbot-qa div
    chatbot_errors = last_chatbot_qa.find_element(By.CLASS_NAME, "chatbot-errors")
    # Retrieve the error messages from the system
    if chatbot_errors.text != "":
        error += "Errors from the system [" + chatbot_errors.text + "]"

    # Find the alert messages stored in the local storage
    alert_messages = driver.execute_script("return localStorage.getItem('alertMessages');")
    # Retrieve the alert messages from the system
    if alert_messages != "" and alert_messages != "[]":
        error += "Alert messages from the system [" + alert_messages + "]"

    # Get the current status of the steps
    steps_status = getStepsStatus(driver)

    return sparql_request.text, sparklis_request.text, error, steps_status, chatbot_reasoning.text
