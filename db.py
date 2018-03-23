import sqlite3
import time

def open_connection():
  return sqlite3.connect('game_store.db')

def load_game(game_id):
  conn = open_connection()
  c = conn.cursor()
  c.execute('SELECT * FROM games WHERE game_id=?', (game_id,))
  game_row = c.fetchone()
  conn.close()
  if game_row is None:
    return None
  return game_row[1]

def save_game(game_id, game):
  conn = open_connection()
  c = conn.cursor()
  now = int(time.time())
  c.execute("UPDATE games SET game = ?, last_saved = ? WHERE game_id = ?", (game, now, game_id))
  conn.commit()
  conn.close()

def get_all_game_ids():
  conn = open_connection()
  c = conn.cursor()
  c.execute("SELECT game_id FROM games")
  game_ids = [row[0] for row in c.fetchall()]
  conn.close()
  return game_ids

def create_game(game_id, game):
  conn = open_connection()
  c = conn.cursor()
  now = int(time.time())
  c.execute("INSERT INTO games VALUES (?, ?, ?, ?)", (game_id, game, now, now))
  conn.commit()
  conn.close()

def create_table():
  conn = open_connection()
  c = conn.cursor()
  c.execute('DROP TABLE games')
  c.execute('CREATE TABLE games (game_id integer, game blob, created_at bigint, last_saved bigint, PRIMARY KEY(game_id))')
  conn.commit()
  conn.close()
  
  
