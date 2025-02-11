from selenium import webdriver
from selenium.webdriver.common.by import By

def simulated_user(url: str, interactions, driver = webdriver.Firefox()):
    driver.get(url)
    result = interactions(driver)
    driver.quit()
    return result

def sparklisllm_question(driver, question):
    driver.implicitly_wait(0.5)
    text_box = driver.find_element(by=By.ID, value="user-input")
    text_box.send_keys(question)
    #simulate enter key on text box (event.keyCode == 13)
    #todo fonctionne pas
    driver.execute_script("var event = new KeyboardEvent('keydown', { 'keyCode': 13 }); document.getElementById('user-input').dispatchEvent(event);")
    # sleep for 20 seconds to allow the answer to be computed
    answer = driver.find_element(by=By.ID, value="response") #todo temp à changer
    # while do not contain </commands>
    while answer.text.find("</commands>") == -1: # todo changer pour mieux
        driver.implicitly_wait(0.5)

    return answer.text

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

    
