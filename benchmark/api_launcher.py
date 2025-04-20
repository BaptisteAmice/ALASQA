import subprocess
import time

while True:
    try:
        subprocess.run(["fastapi", "run", "./benchmark/api.py", "--host", "0.0.0.0", "--port", "8000"])
    except Exception as e:
        print(f"Crash: {e}")
    print("Restarting in 5 seconds...")
    time.sleep(5)
