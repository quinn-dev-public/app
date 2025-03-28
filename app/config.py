import os

USE_USER_ISOLATION = bool(os.environ.get('USE_USER_ISOLATION', 'false').lower() == 'true') 