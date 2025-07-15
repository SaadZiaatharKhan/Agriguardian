import os
import pickle
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from dotenv import load_dotenv

load_dotenv()

# Set paths
documents_dir = "Information_About_Crops"
vector_db_dir = "vector_db"
checkpoint_file = "processed_documents.pkl"
processed_files_file = "processed_files.pkl"

# Initialize Google Gemini Embeddings (update model name and ensure proper API keys are set)
embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

# Create vector DB directory if it doesn't exist
os.makedirs(vector_db_dir, exist_ok=True)

# Load checkpoint if exists
if os.path.exists(checkpoint_file):
    with open(checkpoint_file, 'rb') as f:
        documents = pickle.load(f)
else:
    documents = []

# Load list of processed files if exists
if os.path.exists(processed_files_file):
    with open(processed_files_file, 'rb') as f:
        processed_files = pickle.load(f)
else:
    processed_files = set()


def process_pdf(file_path, metadata):
    print(f"Processing: {file_path}")
    loader = PyPDFLoader(file_path)
    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=200, chunk_overlap=100)
    chunks = splitter.split_documents(docs)
    for chunk in chunks:
        chunk.metadata.update(metadata)
    return chunks

# Traverse the documents directory recursively
def traverse_and_process(base_dir):
    for class_folder in os.listdir(base_dir):
        class_path = os.path.join(base_dir, class_folder)
        if not os.path.isdir(class_path):
            continue
        for subject_folder in os.listdir(class_path):
            subject_path = os.path.join(class_path, subject_folder)
            if not os.path.isdir(subject_path):
                continue

            # Check if there are sub-subdirectories
            has_subdirs = any(os.path.isdir(os.path.join(subject_path, item)) for item in os.listdir(subject_path))

            if has_subdirs:
                # Process each subdirectory
                for sub_subject in os.listdir(subject_path):
                    sub_path = os.path.join(subject_path, sub_subject)
                    if not os.path.isdir(sub_path):
                        continue
                    _process_folder(sub_path, class_folder, subject_folder)
            else:
                # Process files directly under subject_path
                _process_folder(subject_path, class_folder, subject_folder)


def _process_folder(folder_path, class_folder, subject_folder):
    for entry in os.listdir(folder_path):
        entry_path = os.path.join(folder_path, entry)
        if os.path.isdir(entry_path):
            # Recurse into nested folders
            _process_folder(entry_path, class_folder, subject_folder)
        elif entry.lower().endswith('.pdf'):
            if entry_path in processed_files:
                continue
            metadata = {
                "source": class_folder,
                "crop": subject_folder,
                "file": entry,
                "page": "Unknown"
            }
            try:
                chunks = process_pdf(entry_path, metadata)
                documents.extend(chunks)
                processed_files.add(entry_path)
                # Update checkpoint files after each successful processing
                with open(checkpoint_file, 'wb') as f:
                    pickle.dump(documents, f)
                with open(processed_files_file, 'wb') as f:
                    pickle.dump(processed_files, f)
            except Exception as e:
                print(f"Error processing {entry_path}: {e}")

if __name__ == '__main__':
    print("Starting document processing...")
    traverse_and_process(documents_dir)
    print("Creating Vector Database...")
    vectorstore = Chroma.from_documents(documents, embeddings, persist_directory=vector_db_dir)
    vectorstore.persist()
    print(f"Vector Database stored in {vector_db_dir}")
