from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn
import numpy as np
from PIL import Image
import io
import base64
import datetime
import json
import tensorflow as tf
import os
import logging
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import geocoder
import openmeteo_requests
import pandas as pd
import requests_cache
from retry_requests import retry
# Fix imports for LangChain components
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper
from langchain_community.tools import YouTubeSearchTool
from geopy.geocoders import Nominatim
load_dotenv()

# LangChain imports for building the agent system
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_chroma import Chroma  # Updated import for Chroma
from langchain.tools.retriever import create_retriever_tool
from langchain.agents import create_tool_calling_agent, AgentExecutor, Tool
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains.conversation.memory import ConversationBufferMemory

# Set up logging for debugging
logging.basicConfig(level=logging.INFO)

# Load configuration from environment variables with defaults
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004")
VECTOR_DB_DIR = os.getenv("VECTOR_DB_DIR", "vector_db")  
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.0-flash")
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.3"))

def get_current_location():
    try:
        g = geocoder.ip('me')
        if not g.ok or not g.latlng:
            raise Exception("Could not determine current location")
        return g.latlng
    except Exception as e:
        logging.error(f"Location error: {e}")
        # Return a default location
        return [40.7128, -74.0060]  # New York

# Get current location
location = get_current_location()
if location:
    print(f"Latitude: {location[0]}, Longitude: {location[1]}")
else:
    print("Unable to determine the location.")
    # Fallback coordinates (example: New York City)
    location = [40.7128, -74.0060]

# Set up caching and retry mechanisms for weather data requests
cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

# Define weather API parameters
url = "https://api.open-meteo.com/v1/forecast"
params = {
    "latitude": location[0],
    "longitude": location[1],
    "current_weather": True,
    "current": ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m"]
}

# Fetch weather data
try:
    responses = openmeteo.weather_api(url, params=params)
    response = responses[0]

    # Extract current weather variables
    current = response.Current()
    current_temperature_2m = current.Variables(0).Value()
    current_relative_humidity_2m = current.Variables(1).Value()
    current_precipitation = current.Variables(2).Value()
    current_wind_speed_10m = current.Variables(3).Value()
except Exception as e:
    print(f"Error fetching weather data: {e}")
    # Fallback weather values
    current_temperature_2m = 25.0
    current_relative_humidity_2m = 60.0
    current_precipitation = 0.0
    current_wind_speed_10m = 5.0
    
cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
weather_client = openmeteo_requests.Client(session=retry_session)

def get_weather_for_my_area(_: str) -> str:
    coords = get_current_location()
    lat, lon = coords
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current_weather": True,
        "current": ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m"]
    }
    try:
        response = weather_client.weather_api(url, params=params)[0]
        curr = response.Current()
        data = {
            "temperature": curr.Variables(0).Value(),
            "humidity": curr.Variables(1).Value(),
            "precipitation": curr.Variables(2).Value(),
            "wind_speed": curr.Variables(3).Value()
        }
    except Exception as e:
        logging.error(f"Weather fetch error: {e}")
        data = {"temperature": None, "humidity": None, "precipitation": None, "wind_speed": None}
    return json.dumps(data)

app = FastAPI()

# Make sure the vector db directory exists
os.makedirs(VECTOR_DB_DIR, exist_ok=True)

# Initialize embeddings
embeddings = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL)

try:
    # Try to initialize the vector store
    vectorstore = Chroma(persist_directory=VECTOR_DB_DIR, embedding_function=embeddings)
    retriever = vectorstore.as_retriever(k=10)
except Exception as e:
    logging.error(f"Error initializing vector store: {e}")
    # Create a new empty vector store if loading fails
    try:
        # Delete the directory and recreate it
        import shutil
        if os.path.exists(VECTOR_DB_DIR):
            shutil.rmtree(VECTOR_DB_DIR)
        os.makedirs(VECTOR_DB_DIR, exist_ok=True)
        vectorstore = Chroma(persist_directory=VECTOR_DB_DIR, embedding_function=embeddings)
        retriever = vectorstore.as_retriever(k=10)
    except Exception as inner_e:
        logging.error(f"Failed to create new vector store: {inner_e}")
        # Fallback with in-memory vector store
        vectorstore = Chroma(embedding_function=embeddings)
        retriever = vectorstore.as_retriever(k=10)

# Create a retriever tool for agricultural content from the vector database
retriever_tool = create_retriever_tool(
    retriever,
    "agriculture_search",
    "Search for agricultural content, crop diseases, treatments, and fertilizers from the Chroma database."
)

# Initialize DuckDuckGo search tool for web searches
search = DuckDuckGoSearchAPIWrapper(max_results=10)

# Custom YouTube search tool that cleans the query input for better video recommendations
class CustomYouTubeSearchTool(YouTubeSearchTool):
    def _run(self, query: str, **kwargs):
        # Clean up the query by taking only the first part
        cleaned_query = query.split(",")[0].strip()
        return super()._run(cleaned_query, **kwargs)

youtube = CustomYouTubeSearchTool()

# Initialize the language model for the agent
llm = ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=TEMPERATURE)

# Initialize in-memory conversation memory for context in follow-up queries
memory = ConversationBufferMemory(return_messages=True)

# Load disease recognition model
try:
    disease_model = tf.keras.models.load_model('disease_classification_model.h5')
except Exception as e:
    logging.error(f"Error loading disease classification model: {e}")
    # Create a placeholder model that returns random predictions
    class PlaceholderModel:
        def predict(self, x):
            # Return random predictions for demonstration
            batch_size = x.shape[0]
            return [np.random.random(38) for _ in range(batch_size)]
    disease_model = PlaceholderModel()

# Disease class labels for the classification model
labels = {
    0: 'Apple Scab',
    1: 'Apple Black Rot',
    2: 'Cedar Apple Rust',
    3: 'Healthy Apple',
    4: 'Healthy Blueberry',
    5: 'Cherry Powdery Mildew',
    6: 'Healthy Cherry',
    7: 'Corn Cercospora Leaf Spot',
    8: 'Maize Common Rust',
    9: 'Corn Northern Leaf Blight',
    10: 'Healthy Corn',
    11: 'Grape Black Rot',
    12: 'Grape Black Measles',
    13: 'Grape Leaf Blight',
    14: 'Healthy Grape',
    15: 'Orange Citrus Greening',
    16: 'Peach Bacterial Spot',
    17: 'Healthy Peach',
    18: 'Pepper Bell Bacterial Spot',
    19: 'Healthy Pepper Bell',
    20: 'Potato Early Blight',
    21: 'Potato Late Blight',
    22: 'Healthy Potato',
    23: 'Healthy Raspberry',
    24: 'Healthy Soybean',
    25: 'Squash Powdery Mildew',
    26: 'Strawberry Leaf Scorch',
    27: 'Healthy Strawberry',
    28: 'Tomato Bacterial Spot',
    29: 'Tomato Early Blight',
    30: 'Tomato Late Blight',
    31: 'Tomato Leaf Mold',
    32: 'Tomato Septoria Leaf Spot',
    33: 'Tomato Spider Mites',
    34: 'Tomato Target Spot',
    35: 'Tomato Yellow Leaf Curl Virus',
    36: 'Tomato Mosaic Virus',
    37: 'Healthy Tomato'
}

# In-memory store for latest results (image, prediction)
tmp_store = {'image_data': None, 'prediction': None, 'market_insights': None}

# Define API request model for disease queries
class DiseaseQueryRequest(BaseModel):
    disease_name: str
    query_type: str = "all"  # "about", "causes", "treatment", or "all"
    environmental_conditions: Optional[Dict[str, float]] = None

# Reverse-geocode to find city
geolocator = Nominatim(user_agent="langchain_location_tool")

def get_city_from_coords(coords):
    try:
        location = geolocator.reverse(coords, language='en')
        if not location or 'address' not in location.raw:
            raise Exception(f"Could not reverse geocode coords: {coords}")
        address = location.raw['address']
        # Try to pick city or town or village
        city = address.get('city') or address.get('town') or address.get('village')
        return city or address.get('state') or 'Unknown'
    except Exception as e:
        logging.error(f"Geocoding error: {e}")
        return "Unknown City"

# Define a function to find soil type via DuckDuckGo search
def get_soil_type_for_my_area(_: str) -> str:
    try:
        # ignore input, fetch location dynamically
        coords = get_current_location()
        city = get_city_from_coords(coords)
        query = f"soil type in {city}"
        results = search.run(query)
        return f"City: {city}\nSearch Query: {query}\nResults:\n{results}"
    except Exception as e:
        logging.error(f"Soil type search error: {e}")
        return "Unable to determine soil type information at this time."

@app.post("/snapshot")
async def receive_snapshot(request: Request):
    """
    Process a plant image snapshot, detect disease, generate comprehensive analysis
    including disease information and agricultural recommendations.
    
    This endpoint:
    1. Receives and processes the image
    2. Classifies the disease using the ML model
    3. Generates disease information and crop recommendations
    4. Stores comprehensive results for further reference
    """
    try:
        # Read and process the uploaded image
        buf = await request.body()
        img = Image.open(io.BytesIO(buf)).convert('RGB')

        # Disease classification using the loaded ML model
        img_resized = img.resize((224, 224))
        arr = np.expand_dims(np.array(img_resized)/255.0, axis=0)
        preds = disease_model.predict(arr)
        disease = labels[np.argmax(preds[0])]
        
        # Get timestamp for the prediction
        now = datetime.datetime.utcnow()
        
        # Extract environmental conditions
        env_conditions = {
            'temperature': current_temperature_2m,
            'humidity': current_relative_humidity_2m,
            'precipitation': current_precipitation,
            'wind_speed': current_wind_speed_10m
        }

        # Encode image as base64 data URL for storage and frontend display
        bio = io.BytesIO()
        img.save(bio, format='JPEG')
        data64 = base64.b64encode(bio.getvalue()).decode('utf-8')
        img_data_url = f"data:image/jpeg;base64,{data64}"

        # Store image data temporarily
        tmp_store['image_data'] = img_data_url
        
        # Create the initial prediction structure with empty content for the information fields
        tmp_store['prediction'] = {
            'Disease Prediction': disease,
            'About': "",
            'Causes': "",
            'Treatment Plan': "",
            'Recommended Crops': "",
            'Weed Control': "",
            'Intercultural Operations': "",
            'Irrigation': "",
            'Storage Techniques': "",
            'Planting Methods': "",
            'Soil Management': "",
            'timestamp': now.isoformat() + 'Z'
        }

        # Generate detailed disease info using LangChain agent
        disease_info = await generate_disease_info(disease, "all", env_conditions)
        
        # Update the prediction with the disease information
        tmp_store['prediction']['About'] = disease_info['about']
        tmp_store['prediction']['Causes'] = disease_info['causes']
        tmp_store['prediction']['Treatment Plan'] = disease_info['treatment']
        
        # Add agricultural recommendations to the prediction
        tmp_store['prediction']['Recommended Crops'] = disease_info['recommended_crops']
        tmp_store['prediction']['Weed Control'] = disease_info['weed_control'] 
        tmp_store['prediction']['Intercultural Operations'] = disease_info['intercultural_operations']
        tmp_store['prediction']['Irrigation'] = disease_info['irrigation']
        tmp_store['prediction']['Storage Techniques'] = disease_info['storage_techniques']
        tmp_store['prediction']['Planting Methods'] = disease_info['planting_methods']
        tmp_store['prediction']['Soil Management'] = disease_info['soil_management']

        return JSONResponse(status_code=200, content={"status": "ok", "disease": disease})
    
    except Exception as e:
        logging.error(f"Error processing snapshot: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query_disease")
async def query_disease(query: DiseaseQueryRequest):
    """
    API endpoint to query information about a specific disease.
    Users can request specific types of information: "about", "causes", "treatment", or "all".
    Now also includes agricultural recommendations related to the disease.
    """
    try:
        # Generate detailed disease information using the LangChain agent
        disease_info = await generate_disease_info(
            query.disease_name, 
            query.query_type, 
            query.environmental_conditions
        )
        
        # If the query is for the latest detected disease, update the stored prediction
        if (tmp_store['prediction'] and 
            tmp_store['prediction']['Disease Prediction'].lower() == query.disease_name.lower()):
            
            if query.query_type == "about" or query.query_type == "all":
                tmp_store['prediction']['About'] = disease_info['about']
            
            if query.query_type == "causes" or query.query_type == "all":
                tmp_store['prediction']['Causes'] = disease_info['causes']
                
            if query.query_type == "treatment" or query.query_type == "all":
                tmp_store['prediction']['Treatment Plan'] = disease_info['treatment']
            
            # Update agricultural recommendations
            tmp_store['prediction']['Recommended Crops'] = disease_info['recommended_crops']
            tmp_store['prediction']['Weed Control'] = disease_info['weed_control']
            tmp_store['prediction']['Intercultural Operations'] = disease_info['intercultural_operations']
            tmp_store['prediction']['Irrigation'] = disease_info['irrigation']
            tmp_store['prediction']['Storage Techniques'] = disease_info['storage_techniques']
            tmp_store['prediction']['Planting Methods'] = disease_info['planting_methods']
            tmp_store['prediction']['Soil Management'] = disease_info['soil_management']
        
        return {
            "disease": query.disease_name,
            "query_type": query.query_type,
            "disease_info": disease_info
        }
    
    except Exception as e:
        logging.error(f"Error querying disease info: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

async def generate_disease_info(disease_name: str, query_type: str = "all", environmental_conditions: Optional[Dict[str, float]] = None):
    """
    Enhanced core function that uses LangChain agents to generate detailed information about crop diseases
    and agricultural recommendations.
    
    Args:
        disease_name: The name of the disease to analyze
        query_type: The type of information requested ("about", "causes", "treatment", or "all")
        environmental_conditions: Optional environmental parameters that may affect the disease
        
    Returns:
        Dictionary containing the disease information and agricultural recommendations
    """
    # Variables to store the disease information and agricultural recommendations
    about_info = "Information not available"
    causes_info = "Information not available"
    treatment_info = "Information not available"
    recommended_crops = "Information not available"
    weed_control = "Information not available"
    intercultural_operations = "Information not available"
    irrigation = "Information not available"
    storage_techniques = "Information not available"
    planting_methods = "Information not available"
    soil_management = "Information not available"
    
    # Build the chat prompt with instructions for the agriculture assistant
    chat_prompt = ChatPromptTemplate([
        (
            "system",
            (
                "You are a helpful AI agriculture assistant named AgriGuardian. You help farmers and agricultural "
                "professionals understand crop diseases, their causes, and treatment plans as well as providing "
                "agricultural recommendations based on environmental conditions and disease information. "
                "\n\n"
                "When asked about a crop disease, search your knowledge base for the most relevant content and resources. "
                "Use the retrieved content to generate a concise, clear answer explaining: "
                "1. About the disease - what it is, how it affects plants, visual symptoms, and severity indicators. "
                "2. Causes of the disease - pathogens, environmental factors, transmission, and conditions that promote it. "
                "3. Treatment plan - organic and chemical solutions, amount of chemicals to be applied, prevention methods, application rates, and lifecycle management. "
                "4. Recommended crops - suggest alternative or companion crops considering the soil type and environmental  conditions of user's location. " 
                "5. Weed control - strategies to manage weeds relevant to the affected crop, disease situation and weeds found around user's location. "
                "6. Intercultural operations - he various activities performed on a crop field after sowing and before harvesting, focusing on maintaining optimal growing conditions and maximizing crop yield such as Crop Rotation, Intercropping, Staking, Earthing up ,Mulching, Training, Pruning, Thinning of Fruits, Short Pinching and Termination of Bad Dormacy and other such practices that are relevant to the affected crop, soil type, weather conditions and user's location."
                "7. Irrigation - optimal irrigation practices considering the disease, environmental conditions and user's location. "
                "8. Storage techniques - strategies to protect crops from pests and diseases during storage and transport. "
                "9. Planting methods - optimal planting methods considering the soil type, weather conditions and user's location. "
                "10. Soil management - soil preparation, amendments, and maintenance practices for crop health. "
                "\n\n"
                "First, invoke the GetSoilTypeInMyArea tool to fetch your local soil type and include it in every soil-management and crop-recommendation section—do not ask the user for it. "
                "Then, invoke the GetWeatherForMyArea tool to fetch current weather conditions. "
                "Incorporate both soil type and weather when generating all agricultural recommendations."

                "\n\n"
                "Return your response as a structured JSON object with fields: 'about', 'causes', 'treatment', 'recommended_crops', "
                "'weed_control', 'intercultural_operations', 'irrigation', 'storage_techniques', 'planting_methods' , and 'soil_management'. "
                "Each field should contain a concise single paragraph summary of the respective information. "
                "Do not wrap the JSON in code blocks or other formatting - just return a plain JSON object."
                "\n\n"
                "Relevant agricultural context: {agent_scratchpad}"
            )
        ),
        ("human", "{user_input}")
    ])

    # Format query based on query type
    if query_type == "about":
        query_message = f"Explain in detail what {disease_name} is, including symptoms, appearance, and how it affects crops. Also provide comprehensive agricultural recommendations considering this disease."
    elif query_type == "causes":
        query_message = f"What are the main causes of {disease_name}? Include pathogen information, environmental factors, and conditions that promote this disease. Also provide comprehensive agricultural recommendations considering this disease."
    elif query_type == "treatment":
        query_message = f"Provide a complete treatment plan for {disease_name}, including both organic and chemical solutions, preventive measures, and application rates. Also provide comprehensive agricultural recommendations considering this disease."
    else:  # "all" or any other value
        query_message = f"Provide comprehensive information about {disease_name} including: what it is, its symptoms, causes, a detailed treatment plan, and complete agricultural recommendations (recommended crops, weed control, irrigation, soil management)."

    # Add environmental conditions if provided
    if environmental_conditions:
        conditions_str = ", ".join([f"{k}: {v}" for k, v in environmental_conditions.items()])
        query_message += f" Consider these environmental conditions: {conditions_str}."

    # Perform a vector similarity search on the query message to find relevant information
    try:
        results = vectorstore.similarity_search(query_message, k=10)
        processed_results = []
        for result in results:
            # Clean HTML content from the result
            clean_text = BeautifulSoup(result.page_content, "html.parser").get_text(separator="\n").strip()
            metadata_str = json.dumps(result.metadata, indent=2)
            processed_results.append({
                "content": clean_text,
                "metadata": metadata_str
            })
    except Exception as e:
        logging.error(f"Error in vector similarity search: {e}")
        processed_results = []

    # Build a vector context string from the processed vector search results
    vector_context = "\n\n".join(
        [f"Content: {r['content']}\nSources: {r['metadata']}" for r in processed_results]
    ) if processed_results else "No relevant information found in the vector database."

    # Prepare the tools to be used by the agent
    tools = [
        retriever_tool,
        Tool(
            name="SearchInternet",
            func=search.run,
            description="Search the internet for agriculture-related information"
        ),
        Tool(
            name="YouTubeSearch",
            func=youtube._run,
            description="Search YouTube for relevant videos about agricultural diseases and treatments"
        ),
        Tool(
            name="GetSoilTypeInMyArea",
            func=get_soil_type_for_my_area,
            description="Auto-detect location & fetch local soil type via web search."
        ),
        Tool(
            name="GetWeatherForMyArea",
            func=get_weather_for_my_area,
            description="Get current weather conditions for my location."
        )
    ]
    
    # Create the tool-calling agent
    try:
        agent = create_tool_calling_agent(llm, tools, chat_prompt)
        agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

        # Prepare the input parameters for the agent
        agent_input = {
            "user_input": query_message,
            "agent_scratchpad": vector_context  # pass vector context to the prompt
        }

        # Invoke the agent to generate a response
        agent_response = agent_executor.invoke(agent_input)

        # Extract response text
        if isinstance(agent_response, dict):
            # Handle different possible response formats
            if "text" in agent_response:
                response_text = agent_response["text"]
            elif "output" in agent_response:
                response_text = agent_response["output"]
            else:
                # Fallback to string representation if specific keys not found
                response_text = str(agent_response)
        else:
            response_text = str(agent_response)
    except Exception as e:
        logging.error(f"Error in agent execution: {e}")
        response_text = json.dumps({
            "about": f"Information about {disease_name} is currently unavailable.",
            "causes": f"Causes of {disease_name} are currently unavailable.",
            "treatment": f"Treatment recommendations for {disease_name} are currently unavailable.",
            "recommended_crops": "Crop recommendations are currently unavailable.",
            "weed_control": "Weed control recommendations are currently unavailable.",
            "intercultural_operations": "Intercultural operations recommendations are currently unavailable.",
            "irrigation": "Irrigation recommendations are currently unavailable.",
            "storage_techniques": "Storage techniques recommendations are currently unavailable.",
            "planting_methods": "Planting methods recommendations are currently unavailable.",
            "soil_management": "Soil management recommendations are currently unavailable."
        })
    
    # Try to parse JSON from the response
    try:
        # Search for JSON in the text, accounting for possible code block formatting
        import re
        
        # Handle the case where response_text is already a dictionary
        if isinstance(response_text, dict):
            if "output" in response_text:
                # Extract from the 'output' field
                output_text = response_text["output"]
                
                # Look for JSON in code blocks first
                code_block_match = re.search(r'(?:json)?\s*(\{.+?\})\s', output_text, re.DOTALL)
                if code_block_match:
                    json_str = code_block_match.group(1)
                else:
                    # Otherwise look for JSON directly
                    json_match = re.search(r'\{.+?\}', output_text, re.DOTALL)
                    if json_match:
                        json_str = json_match.group(0)
                    else:
                        json_str = output_text  # Try the whole output as JSON
            else:
                # If it's a dict but doesn't have 'output', try to use it directly
                json_str = json.dumps(response_text)
        else:
            # Handle string response
            # First check if JSON is wrapped in code blocks (json ... )
            code_block_match = re.search(r'(?:json)?\s*(\{.+?\})\s', response_text, re.DOTALL)
            if code_block_match:
                json_str = code_block_match.group(1)
            else:
                # Otherwise look for JSON object directly
                json_match = re.search(r'\{.+?\}', response_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    raise ValueError("No JSON object found in response")
        
        # Clean and parse the JSON
        if isinstance(json_str, str):
            json_str = json_str.strip()
            # Handle escaped quotes in JSON string
            json_str = json_str.replace(r'\"', '"')
            disease_data = json.loads(json_str)
        else:
            # If json_str is already a dict, use it directly
            disease_data = json_str
        
        # Extract the disease information
        if "about" in disease_data and query_type in ["about", "all"]:
            about_info = disease_data["about"]
        if "causes" in disease_data and query_type in ["causes", "all"]:
            causes_info = disease_data["causes"]
        if "treatment" in disease_data and query_type in ["treatment", "all"]:
            treatment_info = disease_data["treatment"]
            
        # Extract agricultural recommendations
        if "recommended_crops" in disease_data:
            recommended_crops = disease_data["recommended_crops"]
        if "weed_control" in disease_data:
            weed_control = disease_data["weed_control"]
        if "intercultural_operations" in disease_data:
            intercultural_operations = disease_data["intercultural_operations"]
        if "irrigation" in disease_data:
            irrigation = disease_data["irrigation"]
        if "storage_techniques" in disease_data:
            storage_techniques = disease_data["storage_techniques"]
        if "planting_methods" in disease_data:
            planting_methods = disease_data["planting_methods"]
        if "soil_management" in disease_data:
            soil_management = disease_data["soil_management"]
    except Exception as e:
        logging.error(f"Error parsing JSON from response: {e}", exc_info=True)
        logging.info(f"Response text that failed to parse: {response_text}")
        # Fallback to default values if JSON parsing fails
    
    # Save to memory for potential follow-up questions
    memory.save_context({"user_input": query_message}, {"agent_response": response_text})
    
    return {
        "disease": disease_name,
        "query_type": query_type,
        "about": about_info,
        "causes": causes_info,
        "treatment": treatment_info,
        "recommended_crops": recommended_crops,
        "weed_control": weed_control,
        "intercultural_operations": intercultural_operations,
        "irrigation": irrigation,
        "storage_techniques": storage_techniques,
        "planting_methods": planting_methods,
        "soil_management": soil_management,
        "vector_results": processed_results[:2] if processed_results else []  # Just return the first two results to keep response size reasonable
    }

@app.get("/latest_snapshot")
async def latest():
    """
    Return the latest snapshot analysis including the image and comprehensive prediction data.
    """
    if not tmp_store['prediction']:
        raise HTTPException(status_code=404, detail="No snapshot available")
        
    return JSONResponse(content={
        'image': tmp_store['image_data'],
        'prediction': tmp_store['prediction']
    })

@app.post("/searchdata")
async def searchdata(request: Request):
    """
    Search endpoint to query agricultural data based on specified parameters.
    This endpoint allows searching through the application's agricultural database and external sources.
    
    The request should contain search parameters such as:
    - query: The search term or phrase
    - filters: Optional category filters to narrow results
    - date_range: Optional timeframe for data
    - location: Optional geographic constraints
    
    Returns structured search results with relevant agricultural information.
    """

    try:

        # Parse the request JSON body
        data = await request.json()
        query = data.get("query", "")
        filters = data.get("filters", {})
        
        # Log the search request
        logging.info(f"Search request: {query}, filters: {filters}")
        now = datetime.datetime.utcnow()
        
        # Extract environmental conditions
        env_conditions = {
            'temperature': current_temperature_2m,
            'humidity': current_relative_humidity_2m,
            'precipitation': current_precipitation,
            'wind_speed': current_wind_speed_10m
        }
        
        # Create the initial prediction structure with empty content for the information fields
        tmp_store['market_insights'] = {
            'Current Price': "",
            'Average Price': "",
            'Selling Advice': "",
            'Market Insights': "",
            'Market Demand': "",
            'Market Supply': "",
            'Government Policy': "",
            'Risk Alert': "",
            'timestamp': now.isoformat() + 'Z'
        }

        # Generate detailed disease info using LangChain agent
        market_info = await search_analytics(query, "all", env_conditions)
        
        tmp_store['market_insights']['Current Price'] = market_info['current_price']
        tmp_store['market_insights']['Average Price'] = market_info['average_price']
        tmp_store['market_insights']['Selling Advice'] = market_info['selling_advice']
        tmp_store['market_insights']['Market Insights'] = market_info['market_insights']
        tmp_store['market_insights']['Market Demand'] = market_info['market_demand'] 
        tmp_store['market_insights']['Market Supply'] = market_info['market_supply']
        tmp_store['market_insights']['Government Policy'] = market_info['government_policy']
        tmp_store['market_insights']['Risk Alert'] = market_info['risk_alert']

        return JSONResponse(status_code=200, content={"status": "ok", "market_insights": tmp_store['market_insights'], "timestamp": datetime.datetime.utcnow().isoformat() + 'Z'})
    
    except Exception as e:
        logging.error(f"Error processing snapshot: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

async def search_analytics(query: str, query_type: str = "all", environmental_conditions: Optional[Dict[str, float]] = None):
    """
    Enhanced core function that uses LangChain agents to generate detailed information about crop diseases
    and agricultural recommendations.
    
    Args:
        disease_name: The name of the disease to analyze
        query_type: The type of information requested ("about", "causes", "treatment", or "all")
        environmental_conditions: Optional environmental parameters that may affect the disease
        
    Returns:
        Dictionary containing the disease information and agricultural recommendations
    """
    # Variables to store the disease information and agricultural recommendations
    current_price = "Information not available"
    average_price = "Information not available"
    selling_advice = "Information not available"
    market_insights = "Information not available"
    market_demand = "Information not available"
    market_supply = "Information not available"
    government_policy = "Information not available"
    risk_alert = "Information not available"
    
    # Build the chat prompt with instructions for the agriculture assistant
    chat_prompt = ChatPromptTemplate([
        (
            "system",
            (
                "You are a helpful AI agriculture assistant named AgriGuardian. Given the following market trends for a crop {query}."
                "Suggest Current Price, Average Price, Selling Advice, Market Insights, Market Demand, Market Supply, Government Policy, Risk Alert, on the basis of user's location, soil type and weather conditions and in the context of Indian market and rupees."
                "\n\n"
                "When asked about {query}, search your knowledge base for the most relevant content and resources. "
                "Use the retrieved content to generate a concise, clear answer explaining: "
                "1. Current Price - Current Price of {query} in India in rupees per kilogram. Should be strictly a number only. Decimal is allowed upto two decimal places. "
                "2. Average Price - Average Price of {query} in India in rupees per kilogram. Should be strictly a number only. Decimal is allowed upto two decimal places. "
                "3. Selling advice - Selling advice for {query} in India according to profitability and current market conditions. "
                "4. Market insights - Current market insights for {query} in India. " 
                "5. Market demand - Current demand insights for {query} in India. " 
                "6. Market supply - Current supply insights for {query} in India. " 
                "7. Government policy - Governnment Policy regarding {query} in India. "
                "8. Risk alert - Risk alert for {query} in India according to current market conditions. "
                "\n\n"
                "First, invoke the GetSoilTypeInMyArea tool to fetch your local soil type and include it in every soil-management and crop-recommendation section—do not ask the user for it. "
                "Then, invoke the GetWeatherForMyArea tool to fetch current weather conditions. "
                "Incorporate both soil type and weather when generating all agricultural recommendations."

                "\n\n"
                "Return your response as a structured JSON object with fields: 'current_price', 'average_price', 'selling_advice', 'market_insights', 'market_demand', 'market_supply', 'government_policy' and 'risk_alert' . "
                "Each field should contain a concise single paragraph summary of the respective information. "
                "Do not wrap the JSON in code blocks or other formatting - just return a plain JSON object."
                "\n\n"
                "Relevant agricultural context: {agent_scratchpad}"
            )
        ),
        ("human", "{user_input}")
    ])

    # Format query based on query type
    if query_type == "current_price":
        query_message = f"Current Price of {query} in Indian in rupees. Should be strictly a number only. Decimal is allowed upto two decimal places."
    elif query_type == "average_price":
        query_message = f"Average Price of {query} in Indian in rupees. Should be strictly a number only. Decimal is allowed upto two decimal places."
    elif query_type == "selling_advice":
        query_message = f"Selling advice for {query} in India according to profitability and current market conditions."
    else:  # "all" or any other value
        query_message = f"Provide comprehensive information about {query} including: Current Price, Average Price, Selling Advice, Market Insights, Market Demand, Market Supply, Government Policy, Risk Alert."

    # Add environmental conditions if provided
    if environmental_conditions:
        conditions_str = ", ".join([f"{k}: {v}" for k, v in environmental_conditions.items()])
        query_message += f" Consider these environmental conditions: {conditions_str}."

    # Perform a vector similarity search on the query message to find relevant information
    try:
        results = vectorstore.similarity_search(query_message, k=10)
        processed_results = []
        for result in results:
            # Clean HTML content from the result
            clean_text = BeautifulSoup(result.page_content, "html.parser").get_text(separator="\n").strip()
            metadata_str = json.dumps(result.metadata, indent=2)
            processed_results.append({
                "content": clean_text,
                "metadata": metadata_str
            })
    except Exception as e:
        logging.error(f"Error in vector similarity search: {e}")
        processed_results = []

    # Build a vector context string from the processed vector search results
    vector_context = "\n\n".join(
        [f"Content: {r['content']}\nSources: {r['metadata']}" for r in processed_results]
    ) if processed_results else "No relevant information found in the vector database."

    # Prepare the tools to be used by the agent
    tools = [
        retriever_tool,
        Tool(
            name="SearchInternet",
            func=search.run,
            description="Search the internet for agriculture-related information"
        ),
        Tool(
            name="YouTubeSearch",
            func=youtube._run,
            description="Search YouTube for relevant videos about agricultural diseases and treatments"
        ),
        Tool(
            name="GetSoilTypeInMyArea",
            func=get_soil_type_for_my_area,
            description="Auto-detect location & fetch local soil type via web search."
        ),
        Tool(
            name="GetWeatherForMyArea",
            func=get_weather_for_my_area,
            description="Get current weather conditions for my location."
        )
    ]
    
    # Create the tool-calling agent
    try:
        agent = create_tool_calling_agent(llm, tools, chat_prompt)
        agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

        # Prepare the input parameters for the agent
        agent_input = {
            "query": query,
            "user_input": query_message,
            "agent_scratchpad": vector_context  # pass vector context to the prompt
        }

        # Invoke the agent to generate a response
        agent_response = agent_executor.invoke(agent_input)

        # Extract response text
        if isinstance(agent_response, dict):
            # Handle different possible response formats
            if "text" in agent_response:
                response_text = agent_response["text"]
            elif "output" in agent_response:
                response_text = agent_response["output"]
            else:
                # Fallback to string representation if specific keys not found
                response_text = str(agent_response)
        else:
            response_text = str(agent_response)
    except Exception as e:
        logging.error(f"Error in agent execution: {e}")
        response_text = json.dumps({
            "current_price": f"N/A",
            "average_price": f"N/A",
            "selling_advice": f"Selling Advice not available.",
            "market_insights": f"Market Insights not available.",
            "market_demand": f"Market Demand not available.",
            "market_supply": f"Market Supply not available.",
            "government_policy": f"Government Policy not available.",
            "risk_alert": f"Risk Alert not available."
        })
    
    # Try to parse JSON from the response
    try:
        # Search for JSON in the text, accounting for possible code block formatting
        import re
        
        # Handle the case where response_text is already a dictionary
        if isinstance(response_text, dict):
            if "output" in response_text:
                # Extract from the 'output' field
                output_text = response_text["output"]
                
                # Look for JSON in code blocks first
                code_block_match = re.search(r'(?:json)?\s*(\{.+?\})\s', output_text, re.DOTALL)
                if code_block_match:
                    json_str = code_block_match.group(1)
                else:
                    # Otherwise look for JSON directly
                    json_match = re.search(r'\{.+?\}', output_text, re.DOTALL)
                    if json_match:
                        json_str = json_match.group(0)
                    else:
                        json_str = output_text  # Try the whole output as JSON
            else:
                # If it's a dict but doesn't have 'output', try to use it directly
                json_str = json.dumps(response_text)
        else:
            # Handle string response
            # First check if JSON is wrapped in code blocks (json ... )
            code_block_match = re.search(r'(?:json)?\s*(\{.+?\})\s', response_text, re.DOTALL)
            if code_block_match:
                json_str = code_block_match.group(1)
            else:
                # Otherwise look for JSON object directly
                json_match = re.search(r'\{.+?\}', response_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    raise ValueError("No JSON object found in response")
        
        # Clean and parse the JSON
        if isinstance(json_str, str):
            json_str = json_str.strip()
            # Handle escaped quotes in JSON string
            json_str = json_str.replace(r'\"', '"')
            market_info = json.loads(json_str)
        else:
            # If json_str is already a dict, use it directly
            market_info = json_str
        
        # Extract the disease information
        if "current_price" in market_info and query_type in ["current_price", "all"]:
            current_price = market_info["current_price"]
        if "average_price" in market_info and query_type in ["average_price", "all"]:
            average_price = market_info["average_price"]
        if "selling_advice" in market_info and query_type in ["selling_advice", "all"]:
            selling_advice = market_info["selling_advice"]
            
        # Extract agricultural recommendations
        if "market_insights" in market_info:
            market_insights = market_info["market_insights"]
        if "market_demand" in market_info:
            market_demand = market_info["market_demand"]
        if "market_supply" in market_info:
            market_supply = market_info["market_supply"]
        if "government_policy" in market_info:
            government_policy = market_info["government_policy"]
        if "risk_alert" in market_info:
            risk_alert = market_info["risk_alert"]
    except Exception as e:
        logging.error(f"Error parsing JSON from response: {e}", exc_info=True)
        logging.info(f"Response text that failed to parse: {market_info}")
        # Fallback to default values if JSON parsing fails
    
    return {
        "query_type": query_type,
        "current_price": current_price,
        "average_price": average_price,
        "selling_advice": selling_advice,
        "market_insights": market_insights,
        "market_demand": market_demand,
        "market_supply": market_supply,
        "government_policy": government_policy,
        "risk_alert": risk_alert,
        "vector_results": processed_results[:2] if processed_results else []  # Just return the first two results to keep response size reasonable
    }

@app.get("/")
async def root():
    """
    Root endpoint to check if API is running
    """
    return {"message": "AgriGuardian API is running. Use /snapshot to analyze plant images."}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)