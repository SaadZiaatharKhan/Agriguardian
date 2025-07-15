from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings

def test_vector_db(persist_dir: str, embedding_model: str, query: str, k: int = 5):
    """
    Connect to a persisted Chroma vector store and run a similarity search.

    Args:
        persist_dir (str): Path to the Chroma persistence directory.
        embedding_model (str): The name or path of the embedding model.
        query (str): Text query to search for.
        k (int): Number of top results to return.
    """
    # 1. Initialize your embedding function
    embeddings = GoogleGenerativeAIEmbeddings(model=embedding_model)

    # 2. Load the persisted Chroma vector store
    vectorstore = Chroma(
        persist_directory=persist_dir,
        embedding_function=embeddings
    )

    # 3. Run a similarity search
    docs = vectorstore.similarity_search(query, k=k)

    # 4. Print out the results
    print(f"Top {k} results for query: '{query}'\n{'-'*60}")
    for i, doc in enumerate(docs, start=1):
        print(f"[{i}] Text:\n{doc.page_content}\n")
        print(f"    Metadata: {doc.metadata}\n")

if __name__ == "__main__":
    # Adjust these paths/values to match your environment
    PERSIST_DIR = "agriculture_vector_db"   # same as VECTOR_DB_DIR
    EMBEDDING_MODEL = "models/text-embedding-004"
    TEST_QUERY = "early blight treatment in potatoes"

    test_vector_db(PERSIST_DIR, EMBEDDING_MODEL, TEST_QUERY, k=5)
