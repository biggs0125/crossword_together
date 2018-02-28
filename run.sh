export FLASK_APP=run_server.py
python3 puzzles.py &
flask run --host=0.0.0.0 &
