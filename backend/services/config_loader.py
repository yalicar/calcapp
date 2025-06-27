import os
import yaml

CONFIG_PATH = os.path.join(os.path.dirname(__file__), '..', 'string_config.yaml')

def load_string_config():
    try:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as file:
            config = yaml.safe_load(file)
        return config
    except FileNotFoundError:
        raise FileNotFoundError(f"Config file not found at {CONFIG_PATH}")
    except yaml.YAMLError as e:
        raise ValueError(f"Error parsing YAML config: {e}")

def load_yaml_config(file_path: str) -> dict:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Config file not found: {file_path}")
    
    with open(file_path, 'r') as f:
        return yaml.safe_load(f)