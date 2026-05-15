# Render Free has tight CPU/RAM limits, so one threaded worker keeps startup light.
workers = 1
worker_class = "gthread"
threads = 4

# Cold starts and Neon wakeups can be slow; keep requests alive long enough to finish.
timeout = 120
keepalive = 5

# Load the Flask app once during Gunicorn startup instead of lazily on first request.
preload_app = True
