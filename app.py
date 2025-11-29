from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/save', methods=['POST'])
def save_diagram():
    data = request.json
    # In a real app, we would save this to a database or file
    # For now, we just echo it back or log it
    print("Received diagram data:", data)
    return jsonify({"status": "success", "message": "Diagram saved successfully"})

@app.route('/api/load', methods=['GET'])
def load_diagram():
    # Placeholder for loading logic
    return jsonify({"status": "success", "data": {}})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
