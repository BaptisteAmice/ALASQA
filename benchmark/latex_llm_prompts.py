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
## Task: Generate knowledge graph query commands for Sparklis (SPARQL-based tool) on a Wikidata endpoint.

## Format:
1. Think step by step about what entities and relationships are needed.
2. Finish your response with a sequence of commands, separated by semicolons (;), and wrapped in <commands>...</commands>.

### Available Commands:
- a [class] → Retrieve entities of a given class (e.g., "a book" to find books). **⚠️ IMPORTANT:** If the question already contains the name of an entity (e.g., the title of the book), DO NOT use "a [class]". Directly query the entity instead.
- [entity] → Retrieve a specific entity (e.g., "Albert Einstein" to find the entity representing Einstein). Use this when asking about a specific thing or individual.
- property [property] → Retrieve a specific property (e.g., "property height" to find the height of an entity).
- higherThan [number], lowerThan [constant number] → Value constraints (e.g., "property weight; higherThan 10").
- after [date], before [date] → Time constraints (e.g., "property release date ; after 2000").
- groupBy count → Can only be used if a property as been called previously. Group on the subject of the relation of the last property command and for each of them count the number objects (e.g. property film director ; groupBy count).
- asc, desc → Sort the results of the last command in ascending or descending order according to the results of previous command (number or date).
- limit [constant number] → Limit the number of results returned by the last command.
- offset [constant number] → Skip the first N results.

### ⚠️ Best Practice:
**When using property X ; Entity Y, this means "filter the results to only those where property X is linked to Entity Y".**
**To get something that is "the most", you can use the command "asc" or "desc" to sort the results of the last command, then use "limit 1" to get only the first result (or more if you want to get the top N) (e.g., "a human ; property height; desc; limit 1" to get the tallest person).**
**If the question doesn't ask for the first but rather the second or third, you can use "offset" to skip the first N results (e.g., "a human ; property birth date; asc; offset 1; limit 1" to get the second oldest human).**
**It is also possible to use it combined with "groupBy count". For example, "a movie ; property film director ; groupBy count ; desc; limit 1" will give the director with the most films.**

## Examples:
Q: At which school went Yayoi Kusama?
A: 
- The question asks for the school where Yayoi Kusama studied.
- We first retrieve the entity "Yayoi Kusama".
- Then, we follow the "educated at" property to find the corresponding school.
<commands>Yayoi Kusama; property educated at</commands>

Q: What is the boiling point of water?
A: 
- The question asks for the boiling point of water.
- We first retrieve the entity "water".
- Then, we follow the "boiling point" property to get the value.
<commands>water; property boiling point</commands>

Q: Movies by Tim Burton after 1980?
A: 
- The question asks for movies directed by Tim Burton that were released after 1980.
- We start by retrieving entities of type "film".
- Then, we filter these films by the "director" property.
- Next, we match the specific director "Tim Burton".
- Finally, we apply a date filter to include only movies released after 1980.
<commands>a film; property director; Tim Burton; property release date; after 1980</commands>

Q: among the founders of tencent company, who has been member of national people' congress?"
A: 
- The question asks for founders of Tencent who were also members of the National People's Congress.
- We first search for Tencent.
- Then, we follow the "founder" property to find the founders.
- Next, we filter by the "position" property to check roles these founders held.
- Finally, we match "National People's Congress" to find those who were members.
<commands>tencent ; property founder ; property position ; National People's Congress</commands>`
  """
escaped_text = escape_latex(text)
print(escaped_text)