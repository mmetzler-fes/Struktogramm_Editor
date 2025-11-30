from flask import Flask, render_template, request, jsonify
import json
from converter import convert_mermaid_to_nsd

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/save', methods=['POST'])
def save_diagram():
    data = request.json
    print("Received diagram data:", json.dumps(data, indent=2))
    # Here you would typically save to a database or file
    return jsonify({"status": "success", "message": "Diagram saved (logged to console)"})

@app.route('/api/convert_nsd', methods=['POST'])
def convert_nsd():
    data = request.json
    mermaid_code = data.get('mermaid')
    if not mermaid_code:
        return jsonify({"error": "No mermaid code provided"}), 400
    
    try:
        svg_output = convert_mermaid_to_nsd(mermaid_code)
        return jsonify({"svg": svg_output})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/load', methods=['GET'])
def load_diagram():
    # Placeholder for loading logic
    return jsonify({"status": "success", "data": {}})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
