/home/crosswords/crossword_together/crosswords_env/bin/gunicorn --workers 3 --bind unix:crosswords.sock -m 007 wsgi:app &
/home/crosswords/crossword_together/crosswords_env/bin/python3 puzzles.py python3 &
