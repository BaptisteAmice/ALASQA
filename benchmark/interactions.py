from selenium import webdriver
from selenium.webdriver.common.by import By

def simulated_user(url: str, interactions, driver = webdriver.Firefox()):
    driver.get(url)
    result = interactions(driver)
    driver.quit()
    return result

def sparklisllm_question(driver, question):
    driver.implicitly_wait(0.5)

    #deploy llm menu
    llm_menu_button = driver.find_element(by=By.ID, value="chatbot-menu-button")
    llm_menu_button.click()

    # clear all previous messages 
    clear_button = driver.find_element(by=By.ID, value="chatbot-clear-button")
    clear_button.click()

    # Locate the text box and send the question
    print("INPUT: ", question)
    text_box = driver.find_element(by=By.ID, value="user-input")
    text_box.send_keys(question)
  
    # Submit the question
    input_send_button = driver.find_element(by=By.ID, value="input-send-button")
    input_send_button.click()
    
    # Locate the chatbot-response-container and find the last chatbot-qa div
    chatbot_qa_elements = driver.find_elements(By.CSS_SELECTOR, "#chatbot-response-container .chatbot-qa")

    # Get the last chatbot-qa div
    last_chatbot_qa = chatbot_qa_elements[-1]

    # Find the chatbot-question inside the last chatbot-qa div
    chatbot_answer = last_chatbot_qa.find_element(By.CLASS_NAME, "chatbot-answer")

    # Extract and print the text
    print(chatbot_answer.text)

    # while text is empty, wait
    while chatbot_answer.text == "A: ...": #todo trouver mieux
        driver.implicitly_wait(2)

    return chatbot_answer.text

def example_interactions(driver):
    driver.implicitly_wait(0.5)
    text_box = driver.find_element(by=By.NAME, value="my-text")
    submit_button = driver.find_element(by=By.CSS_SELECTOR, value="button")
    text_box.send_keys("Selenium")
    submit_button.click()
    message = driver.find_element(by=By.ID, value="message")
    return message.text
    
# Example of usage
#if __name__ == "__main__":
#    #simulated_user("https://www.selenium.dev/selenium/web/web-form.html", example_interactions)
#    question = "What is the capital of Germany?"
#    response = simulated_user(
#        "http://127.0.0.1:8000/static/osparklis.html",
#        lambda driver: sparklisllm_question(driver, question)
#    )
#    print("Reponse: ", response)

    
