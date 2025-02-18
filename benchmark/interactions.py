from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
import logging

options = Options()
#options.headless = True #to not open the browser #do not seems to work

def simulated_user(url: str, interactions, driver = webdriver.Firefox(options=options)):
    """
    Simulate a given user interaction with a web page
    """
    driver.get(url)
    result, error = interactions(driver)
    return result, error

def sparklisllm_question(driver, question, endpoint_sparql): #todo catch error ici (bien spécifier que c pas idéal, mais empeche crash)
    """
    Interaction with the SparklisLLM system to ask a question
    """
    driver.implicitly_wait(0.5)

    #todo temp solution
    if "wikidata" in endpoint_sparql:
        #Open config modal
        #config_trigger = driver.find_element(By.CSS_SELECTOR, '[data-toggle="modal"][data-target="#config-language-modal"]')
        #config_trigger.click()
        #For the labels of entities, use property *rdfs:label* with language *en*
        #For the labels of classes, properties, and qualifiers, use property *rdfs:label* *en*
        url_extension = '&wikidata_mode=true&entity_lexicon_select=http%3A//www.w3.org/2000/01/rdf-schema%23label&entity_lexicon_lang=en&concept_lexicons_select=http%3A//www.w3.org/2000/01/rdf-schema%23label&concept_lexicons_lang=en&auto-filtering=false'
        driver.get(driver.current_url + url_extension)

    # Set the sparql endpoint
    #todo crash parfois ici
    sparql_endpoint_input = driver.find_element(by=By.ID, value="sparql-endpoint-input")
    sparql_endpoint_input.clear()
    sparql_endpoint_input.send_keys(endpoint_sparql)
    sparql_endpoint_button = driver.find_element(by=By.ID, value="sparql-endpoint-button")
    sparql_endpoint_button.click()

    #deploy llm menu
    llm_menu_button = driver.find_element(by=By.ID, value="chatbot-menu-button")
    llm_menu_button.click()

    # clear all previous messages 
    clear_button = driver.find_element(by=By.ID, value="chatbot-clear-button")
    clear_button.click()

    # Locate the text box and send the question
    logging.info(f"INPUT: {question}")
    text_box = driver.find_element(by=By.ID, value="user-input")
    text_box.send_keys(question)
  
    # Submit the question
    input_send_button = driver.find_element(by=By.ID, value="input-send-button")
    input_send_button.click()
    
    # Locate the chatbot-responses-container and find the last chatbot-qa div
    chatbot_qa_elements = driver.find_elements(By.CSS_SELECTOR, "#chatbot-responses-container .chatbot-qa")

    # Get the last chatbot-qa div
    last_chatbot_qa = chatbot_qa_elements[-1]

    # Find the chatbot-question inside the last chatbot-qa div
    chatbot_answer = last_chatbot_qa.find_element(By.CLASS_NAME, "chatbot-answer")
    #if begin by "Error:" then it is an error
    error = ''
    if chatbot_answer.text.startswith("Error:"):
        error = chatbot_answer.text + "(error of the system)"

    #while the inputs are disabled, we can consider the system is still processing the question
    while text_box.get_attribute("disabled") == "true":
        driver.implicitly_wait(2)

    sparql_request = last_chatbot_qa.find_element(By.CLASS_NAME, "sparql-request")
    return sparql_request.text, error
