def escape_latex(text):
    """
    Escape LaTeX special characters
    """
    text = text.replace('\\', r'\textbackslash{}')
    text = text.replace('&', r'\&')
    text = text.replace('%', r'\%')
    text = text.replace('$', r'\$')
    text = text.replace('#', r'\#')
    text = text.replace('_', r'\_')
    text = text.replace('{', r'\{')
    text = text.replace('}', r'\}')
    text = text.replace('~', r'\textasciitilde{}')
    text = text.replace('^', r'\^{}')
    # Escape angle brackets using texttt
    text = text.replace('<', r'\texttt{\textless{}}')
    text = text.replace('>', r'\texttt{\textgreater{}}')
    
    # Keep line breaks
    text = text.replace('\n', r'\\')
    return text

text = """
Determine whether the expected answer to the given question is a boolean (i.e., "true" or "false", a yes/no question). 
    Think step by step, then respond strictly with <answer>boolean</answer> if the answer is a boolean value. Otherwise, respond with <answer>non-boolean</answer>.
    You must absolutely end your question with <answer>boolean</answer> or <answer>non-boolean</answer>.

    Examples:
    - What is the boiling point of water? → The question is asking for a specific value, not a yes/no question. → <answer>non-boolean</answer>
    - Did Tom Brady win a Super Bowl before 2005? → The question is asking for a yes/no answer based on a specific event. → <answer>boolean</answer>
    - Do all of batman's partner speak english as native language? → The question is asking for a yes/no answer based on either or not every batman's partner speaks english as native language. → <answer>boolean</answer>
    - In welcher Abteilung ist Frau Müller? → The question is asking for a specific department, not a yes/no question. → <answer>non-boolean</answer>
    - Which pope succeeded John Paul II? → The question is asking for a specific name, not a yes/no question. → <answer>non-boolean</answer>

    Now, analyze the following question accordingly:
"""
escaped_text = escape_latex(text)
print(escaped_text)