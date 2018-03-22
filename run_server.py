from flask import Flask, render_template, url_for
app = Flask(__name__)

@app.route('/')
def crossword_page():
    return render_template('crosswords.html',
                           css_url=url_for('static', filename='crosswords.css'),
                           js_url=url_for('static', filename='crosswords.js'))

@app.route('/')
def setup_page():
    return render_template('setup.html',
                           css_url=url_for('static', filename='setup.css'),
                           js_url=url_for('static', filename='setup.js'))

if __name__ == "__main__":
    app.run(host='0.0.0.0')
