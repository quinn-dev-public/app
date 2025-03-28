from flask import Flask, request, send_from_directory, g
import os
import copy

def get_user_specific_config(config):
    """Create a user-specific config based on IP address"""
    if not config.USE_USER_ISOLATION:
        return config
        
    user_ip = request.remote_addr
    if not user_ip:
        user_ip = 'default'  # Fallback if IP cannot be determined
        
    # Create a new config object with user-specific paths
    new_config = copy.deepcopy(config)
    new_config.DOWNLOAD_DIR = os.path.join(new_config.DOWNLOAD_DIR, user_ip)
    new_config.AUDIO_DOWNLOAD_DIR = os.path.join(new_config.DOWNLOAD_DIR, 'audio')
    
    # Ensure user directories exist
    os.makedirs(new_config.DOWNLOAD_DIR, exist_ok=True)
    os.makedirs(new_config.AUDIO_DOWNLOAD_DIR, exist_ok=True)
    
    return new_config

@app.before_request
def before_request():
    if config.USE_USER_ISOLATION:
        if not hasattr(g, 'download_queue'):
            g.download_queue = DownloadQueue(get_user_specific_config(config), notifier) 