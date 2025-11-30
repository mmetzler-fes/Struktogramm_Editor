# Struktogramm Editor Walkthrough

I have successfully created a Flask-based Nassi-Shneiderman Diagram (NSD) editor.

## Features

### 1. Drag & Drop Interface
- **Toolbox**: Located on the left, contains all standard NSD elements.
- **Canvas**: Located on the right, acts as the drop zone for building diagrams.
- **Nesting**: Supports unlimited nesting of blocks (e.g., loops inside loops, commands inside if-branches).

### 2. Supported Blocks
- **Command**: Simple rectangular block for instructions.
- **If / Else**: Branching block with "Ja" (True) and "Nein" (False) paths. Visualized with a V-shape header.
- **For Loop**: Iteration block (Head-controlled) with a left indentation column (L-shape). Control structure is gray, content is white. The L-shape is continuous.
- **While Loop**: Conditional loop (Head-controlled) with a left indentation column (L-shape). Control structure is gray, content is white. The L-shape is continuous.
- **Repeat Loop**: Conditional loop (Foot-controlled) with a left indentation column (L-shape). Control structure is gray, content is white. The L-shape is continuous.
- **Subprogram**: Block representing a function call with double vertical lines.
- **Exit**: Block representing program termination.

### 3. Block Management
- **Layout**: Blocks automatically expand to fit their content and children.
- **Dynamic Width**: The diagram width automatically increases with nesting depth (loops and branches), ensuring that deeply nested structures are not squashed.
- **Delete**: Right-click on any block to open a context menu and delete it.

### 4. Mermaid Export
- The editor automatically generates **Mermaid Flowchart** code corresponding to the visual diagram.
- You can copy this code using the "Export Mermaid" button.
- The generated code uses a graph structure to represent the flow.

### 5. Save Functionality
- A "Save" button sends the diagram's JSON structure to the backend (`/api/save`).
- Currently, the backend logs the data to the console (can be extended to save to DB/File).

## How to Run

1.  Navigate to the project directory:
    ```bash
    cd /home/mmetzler/Documents/Informatik/git/Struktogramm_Editor
    ```
2.  Run the Flask application:
    ```bash
    python3 app.py
    ```
3.  Open your browser and go to `http://localhost:5000`.

## Windows Executable Generation

You can generate a standalone Windows `.exe` file using **PyInstaller**. Since the development environment is Linux, you must run the build process on a Windows machine (or a Windows VM/Container).

### Prerequisites (on Windows)
1.  Install Python.
2.  Install the project dependencies:
    ```bash
    pip install flask pyinstaller
    ```

### Build Steps
1.  Copy the project files to your Windows machine.
2.  Open a terminal (Command Prompt or PowerShell) in the project directory.
3.  Run PyInstaller using the provided spec file:
    ```bash
    pyinstaller struktogramm_editor.spec
    ```
4.  The executable will be created in the `dist` folder: `dist/StruktogrammEditor.exe`.

### Notes
- The `struktogramm_editor.spec` file is configured to include the `templates` and `static` directories automatically.
- `console=True` is set in the spec file, so a terminal window will open alongside the app. Change it to `console=False` in the spec file if you want a background process (but you won't see startup logs).
