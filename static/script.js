document.addEventListener('DOMContentLoaded', () => {
	const draggables = document.querySelectorAll('.draggable-item');
	const canvas = document.getElementById('canvas');

	let graphState = {
		nodes: [], // { id, type, text }
		edges: []  // { from, to, label }
	};

	// Initial Setup
	// Initialize Graph with Start -> End
	graphState.nodes.push({ id: 'start_node_id', type: 'start', text: 'Start' });
	graphState.nodes.push({ id: 'end_node_id', type: 'end', text: 'End' });
	graphState.edges.push({ from: 'start_node_id', to: 'end_node_id' });

	// Drag Start
	draggables.forEach(draggable => {
		draggable.addEventListener('dragstart', (e) => {
			e.dataTransfer.setData('type', draggable.dataset.type);
			e.dataTransfer.effectAllowed = 'copy';
		});
	});

	// Initial Drop Zone (Not needed as we have Start/End, but we need a way to insert)
	// We will render the diagram which will have drop zones on the edges.

	function setupDropZone(zone, onDrop) {
		zone.addEventListener('dragover', (e) => {
			e.preventDefault();
			zone.classList.add('active');
		});

		zone.addEventListener('dragleave', () => {
			zone.classList.remove('active');
		});

		zone.addEventListener('drop', (e) => {
			e.preventDefault();
			e.stopPropagation(); // Prevent bubbling
			zone.classList.remove('active');
			const type = e.dataTransfer.getData('type');
			if (type) {
				onDrop(type);
			}
		});
	}

	function addBlock(type, edgeIndex) {
		// Create new node
		const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
		let block = {
			id: id,
			type: type,
			text: type === 'command' ? 'Do something' : type,
		};

		if (type === 'if_else') {
			block.text = 'Bedingung';
			// For graph model, we don't store branches in the node.
			// We create the structure in the graph.
		} else if (['for_loop', 'while_loop', 'repeat_loop'].includes(type)) {
			if (type === 'for_loop') block.text = 'i = 0 to 10';
			else if (type === 'while_loop') block.text = 'while condition';
			else block.text = 'until condition';
		} else if (type === 'subprogram') {
			block.text = 'Subprogram Name';
		}

		graphState.nodes.push(block);

		// Insert into edge
		const edge = graphState.edges[edgeIndex];
		const fromId = edge.from;
		const toId = edge.to;
		const label = edge.label; // Preserve label on the incoming edge

		// Remove old edge
		graphState.edges.splice(edgeIndex, 1);

		// Add new edges
		if (type === 'if_else') {
			// Create Merge Node
			const mergeId = id + '_merge';
			graphState.nodes.push({ id: mergeId, type: 'join', text: ' ' });

			// Connect: From -> Decision
			graphState.edges.push({ from: fromId, to: id, label: label });

			// Connect: Decision -> Merge (True/False)
			// Create dummy nodes for branches
			const trueDummyId = id + '_true_dummy';
			const falseDummyId = id + '_false_dummy';

			graphState.nodes.push({ id: trueDummyId, type: 'join', text: ' ' });
			graphState.nodes.push({ id: falseDummyId, type: 'join', text: ' ' });

			// True Branch
			graphState.edges.push({ from: id, to: trueDummyId, label: 'Ja' });
			graphState.edges.push({ from: trueDummyId, to: mergeId });

			// False Branch
			graphState.edges.push({ from: id, to: falseDummyId, label: 'Nein' });
			graphState.edges.push({ from: falseDummyId, to: mergeId });

			// Connect: Merge -> To
			graphState.edges.push({ from: mergeId, to: toId });


		} else if (type === 'case') {
			// Case Logic
			// Create Merge Node
			const mergeId = id + '_merge';
			graphState.nodes.push({ id: mergeId, type: 'join', text: ' ' });

			// Connect: From -> Case
			graphState.edges.push({ from: fromId, to: id, label: label });

			// Case 1
			const dummy1Id = id + '_case_' + Date.now() + '_1';
			graphState.nodes.push({ id: dummy1Id, type: 'join', text: ' ' });
			graphState.edges.push({ from: id, to: dummy1Id, label: '1' });
			graphState.edges.push({ from: dummy1Id, to: mergeId });

			// Default
			const dummy2Id = id + '_case_' + Date.now() + '_2';
			graphState.nodes.push({ id: dummy2Id, type: 'join', text: ' ' });
			graphState.edges.push({ from: id, to: dummy2Id, label: 'default' });
			graphState.edges.push({ from: dummy2Id, to: mergeId });

			// Connect: Merge -> To
			graphState.edges.push({ from: mergeId, to: toId });

		} else if (['for_loop', 'while_loop', 'repeat_loop'].includes(type)) {
			// Loop Logic
			// From -> LoopHead
			graphState.edges.push({ from: fromId, to: id, label: label });

			// Loop Body Dummy
			const bodyDummyId = id + '_body_dummy';

			graphState.nodes.push({ id: bodyDummyId, type: 'join', text: ' ' });

			// LoopHead -> BodyDummy
			graphState.edges.push({ from: id, to: bodyDummyId });

			// BodyDummy -> LoopHead (Back edge)
			graphState.edges.push({ from: bodyDummyId, to: id });

			// LoopHead -> To (Exit)
			graphState.edges.push({ from: id, to: toId, label: 'Exit' });

		} else {
			// Simple Block
			graphState.edges.push({ from: fromId, to: id, label: label });
			graphState.edges.push({ from: id, to: toId });
		}

		renderDiagram();
	}

	function createBlockData(type) {
		const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
		let block = {
			id: id,
			type: type,
			text: type === 'command' ? 'Do something' : type,
		};

		if (type === 'if_else') {
			block.branches = [
				{ label: 'Ja', children: [] },
				{ label: 'Nein', children: [] }
			];
			block.text = 'Bedingung';
		} else if (type === 'case') {
			block.branches = []; // Populated by buildStructure
			block.text = 'Switch Var';
		} else if (['for_loop', 'while_loop', 'repeat_loop'].includes(type)) {
			block.children = [];
			if (type === 'for_loop') block.text = 'i = 0 to 10';
			else if (type === 'while_loop') block.text = 'while condition';
			else block.text = 'until condition';
		} else if (type === 'subprogram') {
			block.text = 'Subprogram Name';
		}

		return block;
	}

	// Helper to find edge between two nodes
	const findEdge = (u, v) => graphState.edges.findIndex(e => e.from === u && e.to === v);

	function createNestedDropZone(onDrop) {
		const zone = document.createElement('div');
		zone.className = 'nested-drop-zone';
		setupDropZone(zone, onDrop);
		return zone;
	}

	function createInsertionDropZone(edgeIndex) {
		const zone = document.createElement('div');
		zone.className = 'insertion-drop-zone';
		setupDropZone(zone, (type) => addBlock(type, edgeIndex));
		return zone;
	}

	// Recursive render
	function renderTree(blocks, parentContainer, predecessorId, successorId) {
		let currentPredecessor = predecessorId;

		blocks.forEach(block => {
			const edgeIndex = findEdge(currentPredecessor, block.id);

			if (edgeIndex !== -1) {
				const dropZone = createInsertionDropZone(edgeIndex);
				parentContainer.appendChild(dropZone);
			} else {
				console.warn(`Edge not found: ${currentPredecessor} -> ${block.id}`);
			}

			parentContainer.appendChild(renderBlockGraph(block));

			if (block.exitId) {
				currentPredecessor = block.exitId;
			} else {
				currentPredecessor = block.id;
			}
		});

		const edgeIndex = findEdge(currentPredecessor, successorId);
		if (edgeIndex !== -1) {
			const dropZone = createInsertionDropZone(edgeIndex);

			// Special handling for empty diagram or container
			if (blocks.length === 0) {
				if (predecessorId === 'start_node_id' && successorId === 'end_node_id') {
					dropZone.classList.add('initial-zone');
					dropZone.innerHTML = '<p>Drag blocks here to start</p>';
				} else {
					dropZone.classList.add('empty-container-zone');
					dropZone.innerHTML = '<p>Drop here</p>';
				}
			}

			parentContainer.appendChild(dropZone);
		} else {
			console.warn(`Edge not found: ${currentPredecessor} -> ${successorId}`);
		}
	}

	function renderDiagram() {
		try {
			canvas.innerHTML = '';

			// Convert Graph to Tree for rendering
			// Start from the node AFTER start_node_id to avoid rendering the Start node itself
			const startSuccessors = getSuccessors('start_node_id');
			const firstNodeId = startSuccessors.length > 0 ? startSuccessors[0] : null;

			const tree = firstNodeId ? buildStructure(firstNodeId, 'end_node_id', new Set()) : [];
			console.log('Render Tree:', JSON.stringify(tree, null, 2));

			const container = document.createElement('div');
			container.className = 'nsd-container';

			renderTree(tree, container, 'start_node_id', 'end_node_id');
			canvas.appendChild(container);
			updateMermaid();
		} catch (e) {
			console.error(e);
			canvas.innerHTML = `<div style="color:red; padding:20px;">Error rendering diagram: ${e.message}<br><pre>${e.stack}</pre></div>`;
		}
	}

	function renderBlockGraph(block) {
		const el = document.createElement('div');
		let classes = `nsd-block block-${block.type}`;

		if (['for_loop', 'while_loop', 'repeat_loop'].includes(block.type)) {
			classes += ' block-loop';
		} else if (block.type === 'if_else') {
			classes += ' block-if';
		}

		el.className = classes;
		el.dataset.id = block.id;

		// Content Editable Logic
		const makeEditable = (element, nodeId) => {
			element.contentEditable = true;
			element.addEventListener('blur', (e) => {
				// Update node in graphState
				const node = graphState.nodes.find(n => n.id === nodeId);
				if (node) {
					node.text = e.target.textContent;
					updateMermaid();
				}
			});
			element.addEventListener('click', (e) => e.stopPropagation());
		};

		if (block.type === 'command' || block.type === 'exit' || block.type === 'subprogram' || block.type === 'process') {
			el.textContent = block.text;
			makeEditable(el, block.id);
		}
		else if (block.type === 'if_else') {
			const header = document.createElement('div');
			header.className = 'block-if-header';

			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("class", "if-svg");
			svg.setAttribute("viewBox", "0 0 100 100");
			svg.setAttribute("preserveAspectRatio", "none");
			svg.innerHTML = `
                <line x1="0" y1="0" x2="50" y2="100" stroke="black" stroke-width="1" />
                <line x1="100" y1="0" x2="50" y2="100" stroke="black" stroke-width="1" />
            `;
			header.appendChild(svg);

			const textContainer = document.createElement('div');
			textContainer.style.position = 'absolute';
			textContainer.style.top = '10px';
			textContainer.style.width = '100%';
			textContainer.style.textAlign = 'center';
			textContainer.textContent = block.text;
			makeEditable(textContainer, block.id);
			header.appendChild(textContainer);

			const trueLabel = document.createElement('div');
			trueLabel.style.position = 'absolute';
			trueLabel.style.bottom = '5px';
			trueLabel.style.left = '5px';
			trueLabel.textContent = 'Ja';
			header.appendChild(trueLabel);

			const falseLabel = document.createElement('div');
			falseLabel.style.position = 'absolute';
			falseLabel.style.bottom = '5px';
			falseLabel.style.right = '5px';
			falseLabel.textContent = 'Nein';
			header.appendChild(falseLabel);

			el.appendChild(header);

			const body = document.createElement('div');
			body.className = 'block-if-body';

			block.branches.forEach((branch, index) => {
				const branchEl = document.createElement('div');
				branchEl.className = 'block-if-branch';

				// We need to find the start and end nodes for this branch to render it recursively.
				// The branch children are already built by buildStructure.
				// But `renderTree` needs `predecessorId` and `successorId` to find edges.

				// For a branch:
				// Predecessor: The decision node (block.id)
				// Successor: The merge node (block.exitId)
				// BUT, there might be dummy nodes in between!

				// Wait, `buildStructure` abstracts this.
				// It returns a list of blocks.
				// If the list is empty, it means there are no "content" blocks.
				// But there are still edges!

				// We need to find the edge that represents the "empty" branch or the start of the branch.
				// `buildStructure` doesn't return the dummy nodes.

				// Let's look at the graph structure we created in `addBlock`.
				// Decision -> TrueDummy -> ... -> Merge

				// So for the True branch:
				// Predecessor: TrueDummy (Wait, Decision -> TrueDummy is the "Ja" edge)
				// Successor: Merge

				// We need to find the TrueDummy node ID.
				// We can find it by looking for the edge from Decision with label "Ja".
				const successors = getSuccessors(block.id);
				// We need to check edge labels.
				const trueNodeId = successors.find(s => {
					const l = getEdgeLabel(block.id, s).toLowerCase();
					return l.includes('ja') || l.includes('yes') || l.includes('true');
				});
				const falseNodeId = successors.find(s => s !== trueNodeId);

				const startNodeId = index === 0 ? trueNodeId : falseNodeId;

				// If startNodeId is undefined (e.g. no edge found), use a dummy or skip
				if (!startNodeId) {
					// console.warn('Branch start node not found for index', index);
				} else {
					renderTree(branch.children, branchEl, startNodeId, block.exitId);
				}

				body.appendChild(branchEl);
			});

			el.appendChild(body);
		}
		else if (['for_loop', 'while_loop', 'repeat_loop'].includes(block.type)) {
			const isFootControlled = block.type === 'repeat_loop';

			const header = document.createElement('div');
			header.className = 'block-loop-header';
			header.textContent = block.text;
			makeEditable(header, block.id);

			const body = document.createElement('div');
			body.className = 'block-loop-body';

			const spacer = document.createElement('div');
			spacer.className = 'loop-spacer';
			body.appendChild(spacer);

			const content = document.createElement('div');
			content.className = 'loop-content';

			// Loop Logic:
			// LoopHead -> BodyDummy -> ... -> LoopHead (Back)
			// Exit: LoopHead -> ExitNode

			// We need to find BodyDummy.
			// It's the successor of LoopHead that is NOT the exit.
			const successors = getSuccessors(block.id);
			let bodyStartId = successors.find(s => !getEdgeLabel(block.id, s).toLowerCase().includes('exit'));

			// Safety fallback: if no specific edge found (unlikely for well-formed loop), try mismatch
			// or if loop is malformed but we want to show SOMETHING.
			if (!bodyStartId && successors.length > 0) bodyStartId = successors[0];

			// The "end" of the loop body is the LoopHead itself (back edge), or the node that leads back to it.
			// renderTree expects (predecessor, successor).
			// For empty loop: LoopHead -> BodyDummy. Edge: BodyDummy -> LoopHead.
			// predecessor = BodyDummy. successor = LoopHead.
			// If BodyDummy is bodyStartId. 
			// renderTree([], content, bodyStartId, block.id)
			// It checks edge bodyStartId -> block.id.
			// In empty loop state: BodyDummy -> LoopHead exists. So it should render Drop Zone.
			// If missing drop zone, maybe bodyStartId is undefined?

			renderTree(block.children, content, bodyStartId, block.id);

			body.appendChild(content);

			if (isFootControlled) {
				el.appendChild(body);
				el.appendChild(header);
			} else {
				el.appendChild(header);
				el.appendChild(body);
			}
		} else if (block.type === 'case') {
			const header = document.createElement('div');
			header.className = 'block-case-header';
			header.style.position = 'relative';

			// header text (Condition)
			const textContainer = document.createElement('div');
			textContainer.style.position = 'absolute';
			textContainer.style.top = '5px';
			textContainer.style.width = '100%';
			textContainer.style.textAlign = 'center';
			textContainer.style.zIndex = '5';
			textContainer.textContent = block.text;
			makeEditable(textContainer, block.id);
			header.appendChild(textContainer);

			// SVG Background
			const nBranches = block.branches.length;
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("class", "case-svg");
			svg.setAttribute("viewBox", "0 0 100 100");
			svg.setAttribute("preserveAspectRatio", "none");
			header.appendChild(svg);

			// Geometry Constants
			const splitY = 60; // 60% down
			const segW = 100 / nBranches;

			// 1. Draw Labels (Divs) FIRST so lines can be on top if needed, 
			// but usually text is above lines. Actually we want text above SVG.
			// Let's put text in overlay divs.

			block.branches.forEach((branch, index) => {
				const labelDiv = document.createElement('div');
				labelDiv.className = 'case-header-label'; // Tag for dynamic resizing
				labelDiv.dataset.index = index;
				labelDiv.style.position = 'absolute';
				labelDiv.style.top = splitY + '%';
				labelDiv.style.left = (index * segW) + '%';
				labelDiv.style.width = segW + '%';
				labelDiv.style.height = (100 - splitY) + '%';
				labelDiv.style.textAlign = 'center';
				labelDiv.style.display = 'flex';
				labelDiv.style.alignItems = 'center';
				labelDiv.style.justifyContent = 'center';
				labelDiv.style.zIndex = '5';
				labelDiv.textContent = branch.label;

				// Editable edge label
				labelDiv.contentEditable = true;
				labelDiv.addEventListener('blur', (e) => {
					const edge = graphState.edges.find(ed => ed.from === block.id && ed.to === branch.startNodeId);
					if (edge) {
						edge.label = e.target.textContent;
						updateMermaid();
					}
				});
				labelDiv.addEventListener('click', (e) => e.stopPropagation());
				header.appendChild(labelDiv);
			});


			// 2. Draw Lines
			// Left Diagonal: (0,0) -> (segW, splitY)
			const lineL = document.createElementNS("http://www.w3.org/2000/svg", "line");
			lineL.setAttribute("x1", "0");
			lineL.setAttribute("y1", "0");
			lineL.setAttribute("x2", segW.toString());
			lineL.setAttribute("y2", splitY.toString());
			lineL.setAttribute("stroke", "black");
			lineL.setAttribute("stroke-width", "1");
			svg.appendChild(lineL);

			// Right Diagonal: (100,0) -> (100 - segW, splitY)
			const lineR = document.createElementNS("http://www.w3.org/2000/svg", "line");
			lineR.setAttribute("x1", "100");
			lineR.setAttribute("y1", "0");
			lineR.setAttribute("x2", (100 - segW).toString());
			lineR.setAttribute("y2", splitY.toString());
			lineR.setAttribute("stroke", "black");
			lineR.setAttribute("stroke-width", "1");
			svg.appendChild(lineR);

			// Connection Line (for >2 branches): (segW, splitY) -> (100-segW, splitY)
			if (nBranches > 2) {
				const lineM = document.createElementNS("http://www.w3.org/2000/svg", "line");
				lineM.setAttribute("x1", segW.toString());
				lineM.setAttribute("y1", splitY.toString());
				lineM.setAttribute("x2", (100 - segW).toString());
				lineM.setAttribute("y2", splitY.toString());
				lineM.setAttribute("stroke", "black");
				lineM.setAttribute("stroke-width", "1");
				svg.appendChild(lineM);
			}

			// Vertical Separators
			// From i=1 to N-1
			// They go from splitY to 100 for middle ones?
			// But for i=1 (first separator), it meets Left Diagonal at (segW, splitY).
			// So yes, vertical lines start at splitY.
			// Initial dummy lines, will be updated by ResizeObserver
			for (let i = 1; i < nBranches; i++) {
				const x = i * segW;
				const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
				line.setAttribute("x1", x + "%");
				line.setAttribute("y1", splitY + "%");
				line.setAttribute("x2", x + "%");
				line.setAttribute("y2", "100%");
				line.setAttribute("stroke", "black");
				line.setAttribute("stroke-width", "1");
				line.setAttribute("data-sep-index", i); // Mark for update
				svg.appendChild(line);
			}

			el.appendChild(header);

			const body = document.createElement('div');
			body.className = 'block-case-body';

			block.branches.forEach((branch, index) => {
				const branchEl = document.createElement('div');
				branchEl.className = 'block-case-branch';
				branchEl.dataset.caseId = branch.startNodeId; // ID of the dummy node starting this branch
				branchEl.dataset.label = branch.label; // Store label for context menu check
				branchEl.dataset.index = index;

				// No label inside branch body anymore (moved to header)

				// Content
				const content = document.createElement('div');
				content.style.flex = '1';
				content.style.display = 'flex';
				content.style.flexDirection = 'column';

				renderTree(branch.children, content, branch.startNodeId, block.exitId);
				branchEl.appendChild(content);

				body.appendChild(branchEl);
			});

			el.appendChild(body);

			// Observer for resizing lines
			setTimeout(() => {
				observeCaseResize(el, header, body);
			}, 0);
		}
		return el;
	}

	// Save Button (Download JSON)
	document.getElementById('save-btn').addEventListener('click', () => {
		const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(graphState, null, 2));
		const downloadAnchorNode = document.createElement('a');
		downloadAnchorNode.setAttribute("href", dataStr);
		downloadAnchorNode.setAttribute("download", "struktogramm.json");
		document.body.appendChild(downloadAnchorNode); // required for firefox
		downloadAnchorNode.click();
		downloadAnchorNode.remove();
	});

	// Load Button (Trigger File Input)
	document.getElementById('load-btn').addEventListener('click', () => {
		document.getElementById('load-file-input').click();
	});

	// Handle File Selection
	document.getElementById('load-file-input').addEventListener('change', (event) => {
		const file = event.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const content = e.target.result;
				const data = JSON.parse(content);

				// Basic validation
				if (!data.nodes || !data.edges) {
					throw new Error("Invalid file format: Missing nodes or edges.");
				}

				// Update graph state
				graphState = data;
				renderDiagram();
				alert('Diagram loaded successfully!');
			} catch (error) {
				console.error('Error loading file:', error);
				alert('Error loading file: ' + error.message);
			}
		};
		reader.readAsText(file);

		// Reset input so the same file can be selected again if needed
		event.target.value = '';
	});

	// Save Mermaid Button (Download .mmd)
	document.getElementById('save-mermaid-btn').addEventListener('click', () => {
		const mermaidCode = generateMermaid();
		const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(mermaidCode);
		const downloadAnchorNode = document.createElement('a');
		downloadAnchorNode.setAttribute("href", dataStr);
		downloadAnchorNode.setAttribute("download", "diagram.mmd");
		document.body.appendChild(downloadAnchorNode); // required for firefox
		downloadAnchorNode.click();
		downloadAnchorNode.remove();
	});

	// Export Button (Copy to Clipboard)
	document.getElementById('export-btn').addEventListener('click', () => {
		const mermaidCode = generateMermaid();
		navigator.clipboard.writeText(mermaidCode).then(() => {
			alert('Mermaid code copied to clipboard!');
		});
	});

	// Helper to open modal
	function openExportModal(title, svgContent, filename) {
		const modal = document.getElementById('export-modal');
		const titleEl = document.getElementById('export-title');
		const previewEl = document.getElementById('export-preview');
		const downloadBtn = document.getElementById('download-export-btn');

		titleEl.textContent = title;
		previewEl.innerHTML = svgContent;
		modal.style.display = 'flex';

		downloadBtn.onclick = () => {
			downloadSVG(svgContent, filename);
		};
	}

	document.getElementById('close-export-btn').addEventListener('click', () => {
		document.getElementById('export-modal').style.display = 'none';
	});

	// Export NSD SVG
	document.getElementById('export-nsd-btn').addEventListener('click', () => {
		const mermaidCode = generateMermaid();

		// Show loading state
		const modal = document.getElementById('export-modal');
		const preview = document.getElementById('export-preview');
		document.getElementById('export-title').textContent = 'Struktogramm (NSD)';
		preview.innerHTML = 'Generating...';
		modal.style.display = 'flex';

		fetch('/api/convert_nsd', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mermaid: mermaidCode })
		})
			.then(response => response.json())
			.then(data => {
				if (data.svg) {
					openExportModal('Struktogramm (NSD)', data.svg, 'struktogramm.svg');
				} else {
					preview.innerHTML = 'Error: ' + (data.error || 'Unknown error');
				}
			})
			.catch(err => {
				console.error(err);
				preview.innerHTML = 'Error: ' + err;
			});
	});

	// Export PAP SVG
	document.getElementById('export-pap-btn').addEventListener('click', async () => {
		const mermaidCode = generateMermaid();

		// Show loading state
		const modal = document.getElementById('export-modal');
		const preview = document.getElementById('export-preview');
		document.getElementById('export-title').textContent = 'Programmablaufplan (PAP)';
		preview.innerHTML = 'Generating...';
		modal.style.display = 'flex';

		try {
			const id = 'mermaid-pap-' + Date.now();
			let { svg } = await mermaid.render(id, mermaidCode);

			// Post-process SVG for LibreOffice compatibility
			// Force inline styles and attributes for basic shapes
			const parser = new DOMParser();
			const doc = parser.parseFromString(svg, "image/svg+xml");

			// 1. Fix Node Backgrounds (Rects, Polygons, Circles)
			// Nodes are usually in groups with class 'node'
			doc.querySelectorAll('.node rect, .node polygon, .node circle, .node ellipse').forEach(el => {
				el.setAttribute('fill', '#ffffff');
				el.setAttribute('stroke', '#000000');
				el.setAttribute('stroke-width', '1');
				el.style.fill = '#ffffff';
				el.style.stroke = '#000000';
				el.style.strokeWidth = '1px';
			});

			// 2. Fix Edge Paths
			doc.querySelectorAll('.edgePaths path').forEach(el => {
				el.setAttribute('stroke', '#000000');
				el.setAttribute('stroke-width', '1');
				el.setAttribute('fill', 'none');
				el.style.stroke = '#000000';
				el.style.strokeWidth = '1px';
				el.style.fill = 'none';
			});

			// 3. Fix Arrowheads (Markers)
			doc.querySelectorAll('marker path').forEach(el => {
				el.setAttribute('fill', '#000000');
				el.setAttribute('stroke', '#000000');
				el.style.fill = '#000000';
				el.style.stroke = '#000000';
			});

			// 4. Fix Edge Label Backgrounds
			doc.querySelectorAll('.edgeLabel rect').forEach(el => {
				el.setAttribute('fill', '#ffffff');
				el.setAttribute('stroke', 'none');
				el.style.fill = '#ffffff';
				el.style.stroke = 'none';
			});

			// 5. Fix Text and Alignment
			doc.querySelectorAll('text, tspan').forEach(el => {
				el.setAttribute('fill', '#000000');
				el.setAttribute('stroke', 'none');

				// Handle Alignment: LibreOffice needs the attribute, not just style
				if (el.style.textAnchor) {
					el.setAttribute('text-anchor', el.style.textAnchor);
				} else {
					// Fallback: Default to middle if no anchor specified, as that's typical for diagrams
					// But be careful not to break manual alignment. 
					// Mermaid usually sets it. If it's empty, maybe 'middle' is a safe bet for node labels.
					el.setAttribute('text-anchor', 'middle');
				}

				el.style.fill = '#000000';
				el.style.stroke = 'none';
				el.style.fontFamily = 'Arial, sans-serif';
				el.style.fontSize = '';
			});

			// 5. Remove any foreignObjects if they persist (though htmlLabels: false should prevent them)
			doc.querySelectorAll('foreignObject').forEach(el => el.remove());

			svg = new XMLSerializer().serializeToString(doc.documentElement);

			openExportModal('Programmablaufplan (PAP)', svg, 'programmablaufplan.svg');
		} catch (err) {
			console.error('Mermaid render error:', err);
			preview.innerHTML = 'Error rendering PAP: ' + err.message;
		}
	});


	function downloadSVG(svgContent, filename) {
		const blob = new Blob([svgContent], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function updateMermaid() {
		const mermaidCode = generateMermaid();
		document.getElementById('mermaid-output').textContent = mermaidCode;
	}

	// --- Graph Model & Logic ---

	// --- Graph Model & Logic ---

	function generateMermaid() {
		// Use BFS traversal to only include reachable nodes
		// This filters out "floating" garbage nodes
		let code = 'flowchart TD\n';

		// Add default styling for LibreOffice compatibility
		// explicit style definitions are safer than CSS variables
		code += 'classDef default fill:#fff,stroke:#000,stroke-width:1px;\n';
		code += 'classDef join fill:#fff,stroke:#000,stroke-width:0px;\n'; // Hide joins if visible? Or just small dots.
		// Actually, join nodes are usually skipped in rendering loops, but if they appear they should be white.

		const visited = new Set();
		const queue = ['start_node_id'];
		const edgesToRender = [];
		const nodesToRender = new Set();

		visited.add('start_node_id');

		// 1. Traverse and Collect Reachable Graph
		while (queue.length > 0) {
			const nodeId = queue.shift();
			nodesToRender.add(nodeId);

			// Find outgoing edges
			const outEdges = graphState.edges.filter(e => e.from === nodeId);

			outEdges.forEach(edge => {
				edgesToRender.push(edge);
				if (!visited.has(edge.to)) {
					visited.add(edge.to);
					queue.push(edge.to);
				}
			});
		}

		// 2. Render Nodes
		nodesToRender.forEach(nodeId => {
			const node = graphState.nodes.find(n => n.id === nodeId);
			if (!node) return;
			if (node.type === 'join') return; // Logic below handles paths THROUGH joins, so we don't render them explicitly?
			// Wait, the original logic skipped rendering 'join' nodes but used them for resolution.

			let label = node.text ? node.text.replace(/"/g, "'") : "";

			if (node.type === 'start') code += `${node.id}([Start])\n`;
			else if (node.type === 'end') code += `${node.id}([End])\n`;
			else if (node.type === 'if_else' || node.type === 'case') code += `${node.id}{"${label}"}\n`;
			else if (['for_loop', 'while_loop', 'repeat_loop'].includes(node.type)) code += `${node.id}(["${label}"])\n`;
			else code += `${node.id}["${label}"]\n`;
		});

		// 3. Render Edges (with join node resolution)
		// We iterate reachable nodes and their successors.

		// Helper to resolve path through join nodes
		function resolveSuccessor(nodeId, initialLabel) {
			let currentId = nodeId;
			let label = initialLabel;
			const visitedPath = new Set([nodeId]);

			while (true) {
				const successors = graphState.edges.filter(e => e.from === currentId).map(e => e.to);
				if (successors.length === 0) return null; // Dead end

				const nextId = successors[0]; // Assume linear path for join nodes
				const nextNode = graphState.nodes.find(n => n.id === nextId);

				if (!nextNode) return null;

				if (nextNode.type !== 'join') {
					return { id: nextId, label: label };
				}

				if (visitedPath.has(nextId)) return null; // Cycle detected
				visitedPath.add(nextId);
				currentId = nextId;
				// Keep original label if present
			}
		}

		nodesToRender.forEach(nodeId => {
			const node = graphState.nodes.find(n => n.id === nodeId);
			if (!node || node.type === 'join') return;

			const successors = getSuccessors(nodeId);
			successors.forEach(succId => {
				// Check if this edge was actually traversed? yes if succId is in nodesToRender (or was reachable)
				// But we need the label from the specific edge
				const edge = graphState.edges.find(e => e.from === nodeId && e.to === succId);
				const edgeLabel = edge ? edge.label : "";

				const succNode = graphState.nodes.find(n => n.id === succId);

				if (succNode && succNode.type === 'join') {
					const resolved = resolveSuccessor(succId, edgeLabel);
					if (resolved) {
						// Only render if target is reachable (it must be if we traversed)
						let labelStr = resolved.label ? `|${resolved.label}|` : "";
						code += `${nodeId} -->${labelStr} ${resolved.id}\n`;
					}
				} else {
					let labelStr = edgeLabel ? `|${edgeLabel}|` : "";
					code += `${nodeId} -->${labelStr} ${succId}\n`;
				}
			});
		});

		return code;
	}

	// Helper to find successors
	function getSuccessors(nodeId) {
		return graphState.edges.filter(e => e.from === nodeId).map(e => e.to);
	}

	// Helper to get edge label
	function getEdgeLabel(fromId, toId) {
		const edge = graphState.edges.find(e => e.from === fromId && e.to === toId);
		return edge ? (edge.label || '') : '';
	}

	function buildStructure(startNodeId, stopNodeId, visited) {
		const blocks = [];
		let currentNodeId = startNodeId;

		while (currentNodeId && currentNodeId !== stopNodeId) {
			if (visited.has(currentNodeId)) {
				// Loop detected (back edge)
				// blocks.append ...
				break;
			}

			visited.add(currentNodeId);
			const node = graphState.nodes.find(n => n.id === currentNodeId);
			if (!node) break;

			const successors = getSuccessors(currentNodeId);

			if (node.type === 'case') {
				// Case Logic
				let mergeNodeId;
				if (successors.length >= 2) {
					mergeNodeId = findMergeNode(successors[0], successors[1], node.id);
				} else if (successors.length === 1) {
					const dummySuccs = getSuccessors(successors[0]);
					mergeNodeId = dummySuccs.length > 0 ? dummySuccs[0] : null;
				}

				if (mergeNodeId) {
					const branches = successors.map(succId => {
						const label = getEdgeLabel(currentNodeId, succId);
						const branchBlocks = buildStructure(succId, mergeNodeId, new Set(visited));
						return {
							label: label,
							children: branchBlocks,
							startNodeId: succId
						};
					});

					blocks.push({
						type: 'case',
						id: node.id,
						text: node.text,
						branches: branches,
						exitId: mergeNodeId
					});

					currentNodeId = mergeNodeId;
				} else {
					// Fallback if merge node not found (shouldn't happen in valid graph)
					console.warn('Merge node not found for case', node.id);
					currentNodeId = successors.length > 0 ? successors[0] : null;
				}

			} else if (successors.length === 2) {
				// Decision or Loop Head
				if (node.type.includes('loop')) {
					// Loop Logic
					let bodyStartId, exitId;
					const label0 = getEdgeLabel(currentNodeId, successors[0]).toLowerCase();

					if (label0.includes('exit')) {
						exitId = successors[0];
						bodyStartId = successors[1];
					} else {
						bodyStartId = successors[0];
						exitId = successors[1];
					}

					const bodyBlocks = buildStructure(bodyStartId, currentNodeId, new Set(visited));

					blocks.push({
						type: node.type,
						id: node.id,
						text: node.text,
						children: bodyBlocks
						// exitId: exitId // REMOVED: Loop exit is the loop node itself branching out
					});

					currentNodeId = exitId;
				} else {
					// Decision Logic
					if (node.type !== 'if_else') {
						console.warn(`Node ${node.id} (${node.type}) has 2 successors but is not a decision block! Treating as process.`);
						currentNodeId = successors[0];
						continue;
					}

					const mergeNodeId = findMergeNode(successors[0], successors[1], node.id);
					let yesNodeId, noNodeId;
					const label0 = getEdgeLabel(currentNodeId, successors[0]).toLowerCase();

					if (label0.includes('ja') || label0.includes('yes') || label0.includes('true')) {
						yesNodeId = successors[0];
						noNodeId = successors[1];
					} else {
						yesNodeId = successors[1];
						noNodeId = successors[0];
					}

					const yesBlocks = buildStructure(yesNodeId, mergeNodeId, new Set(visited));
					const noBlocks = buildStructure(noNodeId, mergeNodeId, new Set(visited));

					blocks.push({
						type: 'if_else',
						id: node.id,
						text: node.text,
						branches: [
							{ label: 'Ja', children: yesBlocks },
							{ label: 'Nein', children: noBlocks }
						],
						exitId: mergeNodeId // Store merge node ID
					});

					currentNodeId = mergeNodeId;
				}
			} else if (successors.length === 1) {
				// Process or Dummy
				// Skip if it's a join node OR (empty text AND NOT a placeholder)
				if (node.type === 'join' || (!node.text.trim() && node.text !== '...')) {
					currentNodeId = successors[0];
					continue;
				}

				blocks.push({
					type: node.type,
					id: node.id,
					text: node.text
				});
				currentNodeId = successors[0];
			} else {
				// Terminal or End
				if (node.type !== 'end' && node.type !== 'start') {
					blocks.push({
						type: node.type,
						id: node.id,
						text: node.text
					});
				}
				currentNodeId = null;
			}
		}

		return blocks;
	}

	function findMergeNode(node1Id, node2Id, forbiddenId) {
		// console.log(`Finding merge node for ${node1Id} and ${node2Id}`);
		const visited1 = new Set();
		const queue1 = [node1Id];
		const visited2 = new Set();
		const queue2 = [node2Id];

		let iter = 0;
		while ((queue1.length > 0 || queue2.length > 0) && iter < 1000) {
			iter++;

			// Step 1
			if (queue1.length > 0) {
				const n = queue1.shift();
				if (visited2.has(n)) return n; // Found in other set
				if (!visited1.has(n)) {
					visited1.add(n);
					const succ = getSuccessors(n);
					succ.forEach(s => {
						if (s !== forbiddenId) queue1.push(s);
					});
				}
			}

			// Step 2
			if (queue2.length > 0) {
				const n = queue2.shift();
				if (visited1.has(n)) return n; // Found in other set
				if (!visited2.has(n)) {
					visited2.add(n);
					const succ = getSuccessors(n);
					succ.forEach(s => {
						if (s !== forbiddenId) queue2.push(s);
					});
				}
			}
		}

		console.warn(`Merge node not found for ${node1Id} and ${node2Id}`);
		return null;
	}

	// Context Menu Logic
	const contextMenu = document.createElement('div');
	contextMenu.className = 'context-menu';
	contextMenu.style.display = 'none';
	contextMenu.style.position = 'absolute';
	contextMenu.style.backgroundColor = 'white';
	contextMenu.style.border = '1px solid #ccc';
	contextMenu.style.padding = '5px';
	contextMenu.style.zIndex = '1000';
	contextMenu.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.2)';
	contextMenu.innerHTML = `
		<div class="menu-item" id="cm-add-case" style="display:none; cursor: pointer; padding: 5px 10px;">Add Case</div>
		<div class="menu-item" id="cm-delete" style="cursor: pointer; padding: 5px 10px;">Delete Block</div>
	`;
	document.body.appendChild(contextMenu);

	let currentBlockId = null;
	let currentCaseBranchId = null; // ID of the dummy node for the case branch

	document.addEventListener('contextmenu', (e) => {
		const block = e.target.closest('.nsd-block');
		const caseBranch = e.target.closest('.block-case-branch');

		if (block) {
			e.preventDefault();
			currentBlockId = block.dataset.id;
			currentCaseBranchId = caseBranch ? caseBranch.dataset.caseId : null;

			const type = block.classList.contains('block-case') ? 'case' : 'other';

			const addBtn = document.getElementById('cm-add-case');
			if (type === 'case') {
				addBtn.style.display = 'block';
			} else {
				addBtn.style.display = 'none';
			}

			contextMenu.style.left = `${e.pageX}px`;
			contextMenu.style.top = `${e.pageY}px`;
			contextMenu.style.display = 'block';
		} else {
			contextMenu.style.display = 'none';
		}
	});

	document.addEventListener('click', () => {
		contextMenu.style.display = 'none';
	});

	document.getElementById('cm-delete').addEventListener('click', () => {
		if (currentBlockId) {
			deleteBlock(currentBlockId);
			contextMenu.style.display = 'none';
		}
	});

	document.getElementById('cm-add-case').addEventListener('click', () => {
		if (currentBlockId) {
			addCaseOption(currentBlockId);
			contextMenu.style.display = 'none';
		}
	});

	// Delete Case Listener Removed


	function addCaseOption(blockId) {
		const block = graphState.nodes.find(n => n.id === blockId);
		if (!block) return;

		const successors = getSuccessors(blockId);
		if (successors.length === 0) return;

		// Find merge node
		const mergeId = findMergeNode(successors[0], successors[1] || successors[0], blockId);

		if (!mergeId) {
			console.error("Could not find merge node to add case");
			return;
		}

		const newDummyId = blockId + '_case_' + Date.now();
		graphState.nodes.push({ id: newDummyId, type: 'join', text: ' ' });

		// Logic to insert before default
		// We need to look at the OUTGOING EDGES from blockId
		const outEdges = graphState.edges.filter(e => e.from === blockId);

		// Find edge pointing to a "Default" case
		const defaultEdgeIndex = outEdges.findIndex(e => e.label.toLowerCase().trim() === 'default');

		const count = successors.length + 1; // Used for label if numeric

		const newEdge = { from: blockId, to: newDummyId, label: (count - 1).toString() };
		const toMergeEdge = { from: newDummyId, to: mergeId };

		// Add merge edge
		graphState.edges.push(toMergeEdge);

		// Add connection edge
		// If default exists, we want to insert this edge BEFORE the default edge in the array?
		// Rendering order depends on order in `graphState.edges`.
		if (defaultEdgeIndex !== -1) {
			// We need to find the global index of that default edge
			const realDefaultEdge = outEdges[defaultEdgeIndex];
			const globalIndex = graphState.edges.indexOf(realDefaultEdge);

			if (globalIndex !== -1) {
				graphState.edges.splice(globalIndex, 0, newEdge);
			} else {
				graphState.edges.push(newEdge);
			}
		} else {
			graphState.edges.push(newEdge);
		}

		renderDiagram();
	}

	function deleteCaseOption(blockId, branchStartId) {
		// remove branchStartId node and its subtree until merge node
		// Actually, simplest is to remove the edge from blockId to branchStartId
		// and the edge from branchEnd to mergeNode.
		// And all nodes in betweeen.

		// But wait, if we delete the branch, we just need to delete the subtree starting at branchStartId 
		// that does NOT include the merge node.

		// Find merge node first to know when to stop
		const successors = getSuccessors(blockId);
		// Min constraint: at least 3 branches (2 cases + default)
		if (successors.length <= 3) {
			alert("Cannot delete. Minimum 2 cases + default required.");
			return;
		}

		const otherSucc = successors.find(s => s !== branchStartId);
		const mergeId = findMergeNode(branchStartId, otherSucc, blockId);

		if (!mergeId) return;

		// Function to collect nodes in the branch
		const nodesToDelete = [];
		const queue = [branchStartId];
		const visited = new Set();

		while (queue.length > 0) {
			const n = queue.shift();
			if (n === mergeId) continue;
			if (visited.has(n)) continue;
			visited.add(n);
			nodesToDelete.push(n);

			const succs = getSuccessors(n);
			succs.forEach(s => queue.push(s));
		}

		// Delete nodes
		nodesToDelete.forEach(nid => {
			const idx = graphState.nodes.findIndex(n => n.id === nid);
			if (idx !== -1) graphState.nodes.splice(idx, 1);
			// Edges are cleaned up by filter
		});

		// Cleanup edges
		for (let i = graphState.edges.length - 1; i >= 0; i--) {
			const e = graphState.edges[i];
			if (nodesToDelete.includes(e.from) || nodesToDelete.includes(e.to)) {
				graphState.edges.splice(i, 1);
			}
		}

		renderDiagram();
	}

	function deleteBlock(id) {
		// Graph Model Deletion
		// 1. Find node and its edges
		const nodeIndex = graphState.nodes.findIndex(n => n.id === id);
		if (nodeIndex === -1) return;

		const node = graphState.nodes[nodeIndex];
		const inEdges = graphState.edges.filter(e => e.to === id);
		const outEdges = graphState.edges.filter(e => e.from === id);

		// Helper to recursively collect all internal nodes for complex blocks
		const nodesToDelete = [id];
		if (['if_else', 'for_loop', 'while_loop', 'repeat_loop', 'case'].includes(node.type)) {
			// We need to find all nodes "owned" by this block.
			// This is tricky in a flat graph.
			// Heuristic: Delete immediate dummies and their successors until we hit the exit/merge node.
			// Better: Just delete the main block and heal In -> Exit.
			// But we need to find the Exit/Merge node to connect to.

			// For If/Else: Exit is the Merge node.
			// For Loops: Exit is the node labeled "Exit".

			let exitId = null;
			const successors = getSuccessors(id);

			if (node.type === 'if_else' || node.type === 'case') {
				// Find merge node
				if (successors.length >= 2) {
					exitId = findMergeNode(successors[0], successors[1], id);
				} else if (node.type === 'case' && successors.length === 1) {
					// Handle single-case deletion edge case
					const dummySuccs = getSuccessors(successors[0]);
					exitId = dummySuccs.length > 0 ? dummySuccs[0] : null;
				}
			} else {
				// Loop
				// Exit is the successor with label "Exit"
				exitId = successors.find(s => getEdgeLabel(id, s).toLowerCase().includes('exit'));
			}

			if (exitId) {
				// We want to connect In -> Exit.
				// And delete everything "inside".
				// "Inside" is hard to define perfectly without a traversal.
				// For now, let's just delete the main node and rely on "garbage collection" or manual cleanup?
				// No, that leaves floating nodes.

				// Let's try to remove the specific dummy nodes we created.
				// They usually have IDs like id + '_something'.
				const internalNodes = graphState.nodes.filter(n => n.id.startsWith(id + '_'));
				internalNodes.forEach(n => nodesToDelete.push(n.id));

				// Also update outEdges to be the edges leaving the Exit node
				// Actually, we want to connect In -> Exit's Successor?
				// No, if we delete the Block, we want to bypass it.
				// So In -> [Block ... Exit] -> Out
				// Becomes In -> Out.

				// So we need the successor of the Exit node.
				const exitSuccessors = getSuccessors(exitId);
				if (node.type === 'if_else' || node.type === 'case') {
					const exitSuccessors = getSuccessors(exitId);
					if (exitSuccessors.length > 0) {
						// We assume 1 successor for the block as a whole
						const finalSuccessor = exitSuccessors[0];

						// Add Exit node to deletion list
						nodesToDelete.push(exitId);

						// Update outEdges to point to finalSuccessor
						outEdges.length = 0; // Clear
						outEdges.push({ from: id, to: finalSuccessor }); // Fake edge
					}
				} else {
					// Loop
					// Exit is the successor with label "Exit"
					// This 'exitId' is actually the Next Block/Node in the flow.
					// We SHOULD NOT delete it.
					// We just want to bridge In -> ExitId.

					// outEdges currently contains edges from LoopHead.
					// One of them is to exitId.
					// We want our healed edge to go to exitId.
					outEdges.length = 0;
					outEdges.push({ from: id, to: exitId });
				}
			}
		}

		// 2. Remove nodes and connected edges
		nodesToDelete.forEach(nid => {
			const idx = graphState.nodes.findIndex(n => n.id === nid);
			if (idx !== -1) graphState.nodes.splice(idx, 1);

			// Remove edges connected to deleted nodes
			for (let i = graphState.edges.length - 1; i >= 0; i--) {
				const e = graphState.edges[i];
				if (e.from === nid || e.to === nid) {
					graphState.edges.splice(i, 1);
				}
			}
		});

		/* 
		   If we deleted the Case block (or any complex block), we might have left the parent container empty.
		   e.g. Loop -> Case -> Empty.
		   Healing logic below connects LoopHead -> CaseExit... 
		   If Case is deleted, inEdges (LoopHead->Case) and outEdges (Case->Next or Fake->Next) are connected.
		   So LoopHead -> Next.
		   Next might be BodyDummy? No, Case was inside BodyDummy context?
		   If LoopHead -> BodyDummy -> Case -> BackToLoop.
		   Delete Case.
		   In: BodyDummy->Case. Out: Case->BackToLoop.
		   Heal: BodyDummy->BackToLoop.
		   This creates BodyDummy -> LoopHead.
		   This is the Empty Loop state.
		   
		   Issue: renderBlockGraph might fail to find BodyDummy if we messed up IDs.
		   But if healed correctly, it should work.
		*/

		// 3. Heal connections
		// Connect inEdges.from -> outEdges.to
		if (inEdges.length > 0 && outEdges.length > 0) {
			// Usually 1 in, 1 out for a block in a sequence
			const source = inEdges[0].from;
			const target = outEdges[0].to;

			// Check if edge already exists
			const exists = graphState.edges.some(e => e.from === source && e.to === target);
			if (!exists) {
				graphState.edges.push({ from: source, to: target });
			}
		} else if (inEdges.length > 0 && inEdges[0].from === 'start_node_id') {
			// Special Case: We deleted the last block connected to Start.
			// We should try to connect Start to End if no path exists?
			// Or if we deleted everything, just connect start to end.
			// Check if End node exists and is disconnected
			const endNode = graphState.nodes.find(n => n.id === 'end_node_id');
			if (endNode) {
				// Check if any edge goes to End
				const edgeToEnd = graphState.edges.some(e => e.to === 'end_node_id');
				if (!edgeToEnd) {
					graphState.edges.push({ from: 'start_node_id', to: 'end_node_id' });
				}
			}
		}

		renderDiagram();
	}

	renderDiagram();
});
function observeCaseResize(container, header, body) {
	const svg = header.querySelector('.case-svg');
	if (!svg) return;

	const updateLines = () => {
		if (!body || !header) return;
		const totalWidth = body.offsetWidth;
		if (totalWidth === 0) return;

		// Get all branches
		const branches = Array.from(body.querySelectorAll('.block-case-branch'));
		let currentX = 0;
		const splitY = 60; // 60%

		// Update vertical lines
		// We skip index 0 (left edge is 0)
		// Vertical lines are at the right edge of each branch except the last one

		// We need to map separator index to branch right edge
		// Separator i (1-indexed) is at right edge of branch i-1 (0-indexed)

		branches.forEach((branch, index) => {
			const branchWidth = branch.offsetWidth;
			currentX += branchWidth;

			// Update vertical lines (separator at right of branch)
			// Skip for the last branch as it ends at 100% (no separator line needed)
			if (index < branches.length - 1) {
				const percent = (currentX / totalWidth) * 100;
				const sepIndex = index + 1;
				const line = svg.querySelector(`line[data-sep-index="${sepIndex}"]`);
				if (line) {
					line.setAttribute("x1", percent + "%");
					line.setAttribute("x2", percent + "%");
				}
			}

			// Update label position (for ALL branches)
			const labelDiv = header.querySelector(`.case-header-label[data-index="${index}"]`);
			if (labelDiv) {
				// Calculate left % and width % based on current cumulative width
				// Branch Left edge is currentX - branchWidth
				const branchLeft = currentX - branchWidth;
				const leftPercent = (branchLeft / totalWidth) * 100;
				const widthPercent = (branchWidth / totalWidth) * 100;

				labelDiv.style.left = leftPercent + "%";
				labelDiv.style.width = widthPercent + "%";
			}
		});

		// Update diagonals (if we want them to point to specific places?)
		// Standard representation: Diagonals go to the first and last separator.
		// First separator is at right edge of Branch 0.
		// Last separator is at left edge of Branch N-1 (or right edge of N-2).

		if (branches.length >= 2) {
			const width0 = branches[0].offsetWidth;
			const p0 = (width0 / totalWidth) * 100;

			// Left Diagonal goes to p0
			const lineL = svg.querySelector('line[x1="0"][y1="0"]'); // approximate selector
			// Better: add classes to lines
			// Assume first line appended is L, second is R
			// Or query by explicit attributes we set (we didn't set classes)
			// Let's rely on order or add more logic later if needed.
			// Actually, we can just use the fact that vertical lines have data-sep-index.
			// Diagonals correspond to 
			// L: (0,0) -> (x_sep1, splitY)
			// R: (100,0) -> (x_sep_last, splitY)

			// Let's re-select them carefully.
			// We need to differentiate diagonals from verticals. Verticals have data-sep-index.
			const lines = Array.from(svg.querySelectorAll('line'));
			const diagonals = lines.filter(l => !l.hasAttribute('data-sep-index') && l.getAttribute('stroke') === 'black');

			// Expect 2 or 3 diagonals/top-lines.
			// L: x1=0, y1=0
			// R: x1=100, y1=0

			const diagL = lines.find(l => l.getAttribute('x1') === "0" && l.getAttribute('y1') === "0");
			const diagR = lines.find(l => l.getAttribute('x1') === "100" && l.getAttribute('y1') === "0");
			const horiz = lines.find(l => !l.hasAttribute('data-sep-index') && l.getAttribute('y1') !== "0" && l.getAttribute('x1') !== l.getAttribute('x2')); // middle line

			if (diagL) {
				diagL.setAttribute("x2", p0 + "%");
			}

			// Last separator position
			let widthLast = branches[branches.length - 1].offsetWidth;
			let pLast = 100 - (widthLast / totalWidth) * 100;

			if (diagR) {
				diagR.setAttribute("x2", pLast + "%");
			}

			if (horiz && diagL && diagR) {
				horiz.setAttribute("x1", p0 + "%");
				horiz.setAttribute("x2", pLast + "%");
			}
		}
	};

	const observer = new ResizeObserver(updateLines);
	observer.observe(body);
	// Also observe children?
	// ResizeObserver on body usually catches child layout changes if body size changes.
	// But if body size is fixed and children change distribution? body size might not change.
	// Flexbox re-layout triggers if content changes.
	// If content is editable and changes line breaks, body height changes -> observer triggers.
	// If width changes -> triggers.

	// Initial update
	setTimeout(updateLines, 50);
}
