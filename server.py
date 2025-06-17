from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import webbrowser
import subprocess
import pyjokes
import wikipedia
import re
import os

app = Flask(__name__, static_folder='.')
CORS(app)

def is_math_expression(text):
    """Detect math expressions like 5+5"""
    return re.search(r'\d+\s*[\+\-\*\/]\s*\d+', text)

@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

@app.route('/ask', methods=['POST'])
def ask():
    user_message = request.json.get('message', '').lower().strip()
    wiki_mode = request.json.get('wiki_mode', False)
    response = {"response": ""}

    try:
        # WIKIPEDIA MODE
        if wiki_mode:
            try:
                summary = wikipedia.summary(user_message, sentences=2)
                response["response"] = f"🌍 Wikipedia:\n{summary}"
            except:
                response["response"] = "❌ No Wikipedia results found"

        # NORMAL MODE
        else:
            # 1. OPEN APPS
            if "open" in user_message:
                if "chrome" in user_message:
                    webbrowser.open("https://google.com")
                    response["response"] = "🖥️ Chrome opened!"
                elif "calculator" in user_message:
                    subprocess.Popen('calc.exe' if os.name == 'nt' else 'gnome-calculator', shell=True)
                    response["response"] = "🧮 Calculator launched!"

            # 2. AUTO-CALCULATE
            elif is_math_expression(user_message):
                expr = re.sub(r'\s+', '', user_message)
                try:
                    result = eval(expr)
                    response["response"] = f"🧮 {user_message} = {result}"
                except:
                    response["response"] = "❌ Invalid math"

            # 3. JOKES
            elif "joke" in user_message:
                response["response"] = pyjokes.get_joke()

            # 4. DEFAULT
            else:
                response["response"] = "🔊 Try commands or enable Wikipedia mode"

    except Exception as e:
        response["response"] = f"❌ Error: {str(e)}"

    return jsonify(response)

if __name__ == '__main__':
    app.run(port=5000, debug=True)