from io import StringIO
import requests
import logging
from urllib.parse import urlparse, urljoin
import validators
from lxml import etree
import xml.etree.ElementTree as ET

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Function to extract the base URL from a given link
def get_base_url(link):
    try:
        parsed_url = urlparse(link)
        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
        return base_url
    except Exception as e:
        logger.error(f"Error extracting base URL: {str(e)}")
        return None

# Function to fetch the sitemap URL from the base URL
def get_sitemap_url(url):
    """
    Given a URL, this function extracts its base URL and appends '/sitemap.xml'
    to construct the sitemap URL. It then checks if the sitemap URL is valid.
    
    Parameters:
        url (str): The URL to extract the base URL from.
        
    Returns:
        str: The sitemap URL if it's valid, otherwise None.
    """
    # Parse the given URL to extract components
    parsed_url = urlparse(url)
    
    # Extract the base URL
    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
    
    # Construct the sitemap URL
    sitemap_url = f"{base_url}/sitemap.xml"
    
    try:
        # Perform a GET request to check if the sitemap URL is valid
        response = requests.head(sitemap_url)
        
        # Check if the request was successful (status code 200)
        response.raise_for_status()
        
        # Log successful fetch
        logging.info(f"Sitemap found at {sitemap_url}")
        
        return sitemap_url
    except requests.RequestException as e:
        # Log and handle exceptions
        logging.error(f"An error occurred while checking the sitemap: {e}")
        return None
    
def is_valid_url(url):
    if validators.url(url):
        return True
    else:
        return False
    
def get_sitemaps(sitemap_url):
    try:
        # Fetch the sitemap content from the URL
        response = requests.get(sitemap_url)
        response.raise_for_status()

        # Parse the XML content
        tree = etree.parse(StringIO(response.text))
        root = tree.getroot()

        # Check if it's a sitemap index
        is_sitemap_index = False
        for elem in root.iter():
            if 'sitemapindex' in elem.tag:
                is_sitemap_index = True
                break

        # If it's a sitemap index, collect the sitemap URLs
        if is_sitemap_index:
            sitemap_urls = []
            for loc in root.iterfind('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc'):
                sitemap_urls.append(loc.text)
            return sitemap_urls

        # If it's a single sitemap, return the original URL as a list
        else:
            return [sitemap_url]

    except requests.RequestException as e:
        print(f"An error occurred while fetching the sitemap: {e}")
        return []
    except etree.XMLSyntaxError as e:
        print(f"An error occurred while parsing the XML: {e}")
        return []
    
def fetch_sitemap_contents(sitemap_urls):
    contents = []
    
    for i, url in enumerate(sitemap_urls):
        try:
            # Fetch the content from the URL
            logging.info(f"Fetching content from {url}...")
            response = requests.get(url)
            
            # Check for HTTP errors
            response.raise_for_status()
            
            contents.append(response.text)
            logging.info(f"Successfully fetched content from {url}.")
        
        except requests.RequestException as e:
            logging.error(f"An error occurred while fetching the sitemap from {url}: {e}")
            contents.append(None)  # Append None to maintain the order
            
        except Exception as e:
            # Catch-all for other exceptions
            logging.error(f"An unexpected error occurred while processing {url}: {e}")
            contents.append(None)  # Append None to maintain the order
    
    if not any(contents):
        logging.warning("Failed to fetch content from all sitemap URLs.")
    
    return contents

def parse_sitemap_to_urls(sitemap_data):
    """
    Parse the sitemap XML data and return a list of URLs.

    Parameters:
    sitemap_data (str): The sitemap XML data as a string.

    Returns:
    list: A list of URLs present in the sitemap.
    """

    links = []  # Initialize an empty array to hold the links

    # Safely attempt to parse the XML data
    try:
        root = ET.fromstring(sitemap_data)
    except ET.ParseError as e:
        logging.error(f"Error parsing XML: {e}")
        return links

    # Check for root tag to ensure XML is a sitemap
    if not root.tag.endswith("urlset"):
        logging.warning("Root tag does not indicate a sitemap. Parsing might be incorrect.")
    
    # Dynamically determine the XML namespace
    try:
        namespaces = {'sitemap': root.tag.split('}')[0].strip('{')}
    except IndexError as e:
        logging.error(f"Could not determine XML namespace: {e}")
        return links

    # Loop through each 'url' element to extract the URLs
    for url in root.findall(".//sitemap:url", namespaces):
        loc = url.find('sitemap:loc', namespaces)
        if loc is not None:
            links.append(loc.text)
        else:
            logging.warning("Found a 'url' element without a 'loc' child. Skipping.")

    # Check if any links were found
    if not links:
        logging.warning("No URLs found in the sitemap.")

    return links