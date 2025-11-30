import networkx as nx
import re
import html
import math

# Constants for layout
FONT_SIZE = 14
CHAR_WIDTH_AVG = 8  # Approximate width of a character in pixels
LINE_HEIGHT = 20
PADDING_X = 10
PADDING_Y = 10
MIN_BLOCK_WIDTH = 100

def convert_mermaid_to_nsd(mermaid_content):
    graph, start_node = parse_mermaid(mermaid_content)
    if not start_node:
        return '<svg><text>Error: No start node found</text></svg>'
        
    structured_tree = build_structure(graph, start_node, None, set())
    
    # 1. Calculate Minimum Widths
    # We need to annotate the tree with min_width requirements
    total_min_width = calculate_min_widths(structured_tree)
    
    # Ensure a reasonable total width, but at least the min required
    width = max(800, total_min_width)
    
    # 2. Calculate Heights based on the actual width we will use
    # We pass the available width to calculate wrapping
    total_height = calculate_heights(structured_tree, width)
    
    svg_content = render_blocks(structured_tree, 0, 0, width)
    
    return f'<svg width="{width}" height="{total_height}" xmlns="http://www.w3.org/2000/svg" style="font-family: Arial, sans-serif;">{svg_content}</svg>'

def parse_mermaid(content):
    G = nx.DiGraph()
    lines = content.split('\n')
    edge_pattern = re.compile(r'(.+?)\s*-->\s*(?:\|(.*?)\|\s*)?(.+)')
    
    for line in lines:
        line = line.strip()
        if not line or line.startswith('graph') or line.startswith('%%') or line.startswith('subgraph'):
            continue
            
        if '-->' in line:
            parts = line.split('-->')
            left_part = parts[0].strip()
            right_part = parts[1].strip()
            
            left_id, left_label, left_type = parse_node_str(left_part)
            if left_id:
                if left_id not in G: 
                    G.add_node(left_id, label=left_label, type=left_type)
                else:
                    # Update label if we have a better one (not just ID)
                    if left_label != left_id:
                        G.nodes[left_id]['label'] = left_label
                        G.nodes[left_id]['type'] = left_type
                
            edge_label = ""
            if right_part.startswith('|'):
                end_pipe = right_part.find('|', 1)
                if end_pipe != -1:
                    edge_label = right_part[1:end_pipe]
                    right_part = right_part[end_pipe+1:].strip()
            
            right_id, right_label, right_type = parse_node_str(right_part)
            if right_id:
                if right_id not in G: 
                    G.add_node(right_id, label=right_label, type=right_type)
                else:
                    if right_label != right_id:
                        G.nodes[right_id]['label'] = right_label
                        G.nodes[right_id]['type'] = right_type

            if left_id and right_id:
                G.add_edge(left_id, right_id, label=edge_label)
        else:
            node_id, node_label, node_type = parse_node_str(line)
            if node_id:
                if node_id not in G: 
                    G.add_node(node_id, label=node_label, type=node_type)
                else:
                    if node_label != node_id:
                        G.nodes[node_id]['label'] = node_label
                        G.nodes[node_id]['type'] = node_type

    start_node = None
    for node in G.nodes:
        if G.in_degree(node) == 0:
            start_node = node
            break
    if not start_node and len(G.nodes) > 0:
        start_node = list(G.nodes)[0]
        
    return G, start_node

def parse_node_str(node_str):
    m = re.match(r'(\w+)\s*(\[".*?"\]|\{".*?"\}|\(\[".*?"\]\)|\(\(".*?"\)\)|\(\[.*?\]\))?', node_str)
    if not m: return None, None, None
    node_id = m.group(1)
    rest = m.group(2)
    label = node_id
    node_type = 'process'
    if rest:
        if rest.startswith('["'): label = rest[2:-2]; node_type = 'process'
        elif rest.startswith('{"'): label = rest[2:-2]; node_type = 'decision'
        elif rest.startswith('(["'): label = rest[3:-3]; node_type = 'terminal'
        elif rest.startswith('(("'): label = rest[3:-3]; node_type = 'loop' # My editor uses this for loops
        elif rest.startswith('(['): label = rest[2:-2]; node_type = 'terminal'
    return node_id, label, node_type

def build_structure(G, current_node, stop_node, visited):
    blocks = []
    while current_node and current_node != stop_node:
        if current_node in visited:
            blocks.append({'type': 'process', 'label': f'Loop back to {G.nodes[current_node].get("label", current_node)}'})
            break
        
        visited.add(current_node)
        node_data = G.nodes[current_node]
        label = node_data.get('label', current_node)
        successors = list(G.successors(current_node))
        
        if len(successors) == 2:
            # Check if it's a loop (Head) or Decision
            node_type = G.nodes[current_node].get('type', 'process')
            
            if node_type == 'loop':
                # Identify Body vs Exit
                # My generator: Body edge has no label (or empty), Exit edge has "Exit".
                edge1 = G.get_edge_data(current_node, successors[0])
                label1 = edge1.get('label', '').lower()
                
                if 'exit' in label1:
                    exit_node = successors[0]
                    body_start_node = successors[1]
                else:
                    body_start_node = successors[0]
                    exit_node = successors[1]
                
                # Build Body
                # The body stops when it loops back to current_node
                body_blocks = build_structure(G, body_start_node, current_node, visited.copy())
                
                blocks.append({
                    'type': 'loop',
                    'label': label,
                    'children': body_blocks
                })
                
                current_node = exit_node
            else:
                # Existing Decision Logic
                merge_node = find_merge_node(G, successors[0], successors[1], current_node)
                edge1 = G.get_edge_data(current_node, successors[0])
                label1 = edge1.get('label', '').lower()
                
                if 'ja' in label1 or 'yes' in label1 or 'true' in label1:
                    yes_node = successors[0]; no_node = successors[1]
                else:
                    yes_node = successors[1]; no_node = successors[0]
                
                yes_block = build_structure(G, yes_node, merge_node, visited.copy())
                no_block = build_structure(G, no_node, merge_node, visited.copy())
                
                blocks.append({
                    'type': 'decision',
                    'label': label,
                    'yes': yes_block,
                    'no': no_block
                })
                current_node = merge_node
            
        elif len(successors) == 1:
            
            # Skip empty/dummy nodes
            if not label or not label.strip():
                current_node = successors[0]
                continue

            # My editor generates: id(("label")) for loops.
            # The parser needs to read the node shape or type.
            # parse_mermaid stores 'type' in G.nodes.
            
            node_type = G.nodes[current_node].get('type', 'process')
            
            if node_type == 'terminal' or 'loop' in label.lower() or 'while' in label.lower() or 'for' in label.lower():
                 # It's likely a loop header in my editor's context (if I used specific shapes)
                 # But standard Mermaid might just be a decision.
                 # Let's check if my editor uses specific shapes.
                 # My editor uses (("label")) which is 'terminal' or 'circle' in my parser?
                 # parse_node_str: (["..."]) is terminal. (("...")) is not handled in my ported parser!
                 # I need to update parse_node_str to handle (("...")) as loop.
                 pass

            blocks.append({'type': 'process', 'label': label})
            current_node = successors[0]
        else:
            blocks.append({'type': 'process', 'label': label})
            current_node = None
            
    return blocks

def find_merge_node(G, node1, node2, forbidden_node=None):
    visited1 = set()
    queue1 = [node1]
    
    # Interleaved BFS with forbidden node check
    visited2 = set()
    queue2 = [node2]
    
    iter_count = 0
    while (queue1 or queue2) and iter_count < 1000:
        iter_count += 1
        
        # Step 1
        if queue1:
            n = queue1.pop(0)
            if n in visited2: return n
            if n not in visited1:
                visited1.add(n)
                successors = list(G.successors(n))
                for succ in successors:
                    if succ != forbidden_node:
                        queue1.append(succ)
        
        # Step 2
        if queue2:
            n = queue2.pop(0)
            if n in visited1: return n
            if n not in visited2:
                visited2.add(n)
                successors = list(G.successors(n))
                for succ in successors:
                    if succ != forbidden_node:
                        queue2.append(succ)
                        
    return None

def calculate_min_widths(blocks):
    """
    Recursively calculates the minimum width for a list of blocks.
    Annotates each block with 'min_width'.
    Returns the max min_width of the list.
    """
    max_width = MIN_BLOCK_WIDTH
    
    for block in blocks:
        text_width = len(block['label']) * CHAR_WIDTH_AVG + PADDING_X * 2
        
        if block['type'] == 'process':
            block['min_width'] = max(text_width, MIN_BLOCK_WIDTH)
            
        elif block['type'] == 'decision':
            yes_width = calculate_min_widths(block['yes'])
            no_width = calculate_min_widths(block['no'])
            
            # Decision needs to fit its own label too
            decision_label_width = text_width
            
            # The width of a decision block is the sum of its branches
            # But it also needs to be at least wide enough for its header label
            block['min_width'] = max(yes_width + no_width, decision_label_width)
            
            # Store branch widths for proportional rendering
            block['yes_min_width'] = yes_width
            block['no_min_width'] = no_width

        elif block['type'] == 'loop':
            children_width = calculate_min_widths(block['children'])
            # Loop needs spacer + children
            block['min_width'] = max(text_width, children_width + 30) # 30 is spacer
            
        max_width = max(max_width, block['min_width'])
        
    return max_width

def calculate_heights(blocks, width):
    """
    Recursively calculates height based on available width.
    Annotates each block with 'height'.
    Returns total height.
    """
    total_h = 0
    for block in blocks:
        # Calculate text wrapping
        # Available width for text
        text_area_width = width - PADDING_X * 2
        text_len = len(block['label']) * CHAR_WIDTH_AVG
        lines = math.ceil(text_len / max(1, text_area_width))
        text_height = lines * LINE_HEIGHT + PADDING_Y * 2
        
        if block['type'] == 'process':
            block['height'] = max(40, text_height)
            total_h += block['height']
            
        elif block['type'] == 'decision':
            # ... (existing decision logic) ...
            yes_min = block['yes_min_width']
            no_min = block['no_min_width']
            total_min = yes_min + no_min
            
            yes_w = width * (yes_min / total_min)
            no_w = width - yes_w
            
            yes_h = calculate_heights(block['yes'], yes_w)
            no_h = calculate_heights(block['no'], no_w)
            
            content_height = max(yes_h, no_h)
            header_height = max(40, text_height + 20)
            
            block['height'] = header_height + content_height
            block['header_height'] = header_height
            block['content_height'] = content_height
            block['yes_width'] = yes_w
            block['no_width'] = no_w
            
            total_h += block['height']

        elif block['type'] == 'loop':
            # Loop has a spacer (30px) and content
            spacer_width = 30
            content_width = width - spacer_width
            
            # Calculate content height
            content_h = calculate_heights(block['children'], content_width)
            
            # Header height
            header_height = max(30, text_height)
            
            block['height'] = header_height + content_h
            block['header_height'] = header_height
            block['content_height'] = content_h
            block['spacer_width'] = spacer_width
            block['content_width'] = content_width
            
            total_h += block['height']
            
    return total_h

def render_blocks(blocks, x, y, width):
    svg = ""
    current_y = y
    
    for block in blocks:
        if block['type'] == 'process':
            h = block['height']
            svg += f'<rect x="{x}" y="{current_y}" width="{width}" height="{h}" fill="white" stroke="black" stroke-width="1"/>'
            
            # Render text with wrapping
            lines = wrap_text(block['label'], width - PADDING_X * 2)
            text_y = current_y + PADDING_Y + FONT_SIZE/2
            for line in lines:
                svg += f'<text x="{x + 10}" y="{text_y}" font-size="{FONT_SIZE}" font-family="Arial, sans-serif">{html.escape(line)}</text>'
                text_y += LINE_HEIGHT
                
            current_y += h
            
        elif block['type'] == 'decision':
            header_h = block['header_height']
            content_h = block['content_height']
            yes_w = block['yes_width']
            no_w = block['no_width']
            
            # Header - White background for IF, but with V-shape lines
            svg += f'<rect x="{x}" y="{current_y}" width="{width}" height="{header_h}" fill="white" stroke="black" stroke-width="1"/>'
            svg += f'<line x1="{x}" y1="{current_y}" x2="{x+yes_w}" y2="{current_y+header_h}" stroke="black" stroke-width="1"/>'
            svg += f'<line x1="{x+width}" y1="{current_y}" x2="{x+yes_w}" y2="{current_y+header_h}" stroke="black" stroke-width="1"/>'
            
            # Label
            block_center_x = x + width / 2
            intersection_x = x + yes_w
            label_x = (block_center_x + intersection_x) / 2
            
            svg += f'<text x="{label_x}" y="{current_y + header_h/2}" text-anchor="middle" font-size="{FONT_SIZE}" font-family="Arial, sans-serif">{html.escape(block["label"])}</text>'
            
            # True/False
            svg += f'<text x="{x + yes_w/2}" y="{current_y + header_h - 5}" text-anchor="middle" font-size="12" font-family="Arial, sans-serif">Ja</text>'
            svg += f'<text x="{x + yes_w + no_w/2}" y="{current_y + header_h - 5}" text-anchor="middle" font-size="12" font-family="Arial, sans-serif">Nein</text>'
            
            # Branches
            svg += render_blocks(block['yes'], x, current_y + header_h, yes_w)
            svg += render_blocks(block['no'], x + yes_w, current_y + header_h, no_w)
            
            # Fill empty space
            yes_content_h = sum(b['height'] for b in block['yes'])
            no_content_h = sum(b['height'] for b in block['no'])
            
            if yes_content_h < content_h:
                svg += f'<rect x="{x}" y="{current_y + header_h + yes_content_h}" width="{yes_w}" height="{content_h - yes_content_h}" fill="white" stroke="black" stroke-width="1"/>'
            if no_content_h < content_h:
                svg += f'<rect x="{x + yes_w}" y="{current_y + header_h + no_content_h}" width="{no_w}" height="{content_h - no_content_h}" fill="white" stroke="black" stroke-width="1"/>'
                
            current_y += header_h + content_h

        elif block['type'] == 'loop':
            header_h = block['header_height']
            content_h = block['content_height']
            spacer_w = block['spacer_width']
            content_w = block['content_width']
            
            # L-Shape Polygon (Header + Spacer)
            # Points: Top-Left -> Top-Right -> Bottom-Right(Header) -> Inner-Corner -> Bottom-Right(Spacer) -> Bottom-Left -> Close
            
            p1 = f"{x},{current_y}"
            p2 = f"{x+width},{current_y}"
            p3 = f"{x+width},{current_y+header_h}"
            p4 = f"{x+spacer_w},{current_y+header_h}"
            p5 = f"{x+spacer_w},{current_y+header_h+content_h}"
            p6 = f"{x},{current_y+header_h+content_h}"
            
            svg += f'<polygon points="{p1} {p2} {p3} {p4} {p5} {p6}" fill="#e2e8f0" stroke="black" stroke-width="1"/>'
            
            # Label
            svg += f'<text x="{x + 10}" y="{current_y + header_h/2 + 5}" font-size="{FONT_SIZE}" font-family="Arial, sans-serif">{html.escape(block["label"])}</text>'
            
            # Content Area (White)
            # We draw this *over* the L-shape. 
            # The top edge of this rect will match the bottom edge of the header part of the L-shape.
            # The left edge will match the right edge of the spacer part.
            svg += f'<rect x="{x + spacer_w}" y="{current_y + header_h}" width="{content_w}" height="{content_h}" fill="white" stroke="black" stroke-width="1"/>'
            
            # Render Children
            svg += render_blocks(block['children'], x + spacer_w, current_y + header_h, content_w)
            
            current_y += header_h + content_h

    return svg

def wrap_text(text, max_width):
    """
    Simple word wrap
    """
    words = text.split()
    lines = []
    current_line = []
    current_len = 0
    
    for word in words:
        word_len = len(word) * CHAR_WIDTH_AVG
        if current_len + word_len <= max_width:
            current_line.append(word)
            current_len += word_len + CHAR_WIDTH_AVG # Space
        else:
            if current_line:
                lines.append(" ".join(current_line))
            current_line = [word]
            current_len = word_len
            
    if current_line:
        lines.append(" ".join(current_line))
        
    return lines if lines else [text]
