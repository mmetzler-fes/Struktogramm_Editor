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
			const bodyStartId = successors.find(s => !getEdgeLabel(block.id, s).toLowerCase().includes('exit'));

			// The "end" of the loop body is the LoopHead itself (back edge).
			// So successorId = block.id.

			renderTree(block.children, content, bodyStartId, block.id);

			body.appendChild(content);

			if (isFootControlled) {
				el.appendChild(body);
				el.appendChild(header);
			} else {
				el.appendChild(header);
				el.appendChild(body);
			}
		}

		return el;
	}

	// Save Button
	document.getElementById('save-btn').addEventListener('click', () => {
		fetch('/api/save', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(graphState),
		})
			.then(response => response.json())
			.then(data => {
				alert('Diagram saved! (Check server console)');
			})
			.catch((error) => {
				console.error('Error:', error);
			});
	});

	// Export Button
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
			const { svg } = await mermaid.render(id, mermaidCode);
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
		let code = 'graph TD\n';

		// Helper to resolve path through join nodes
		function resolveSuccessor(nodeId, initialLabel) {
			let currentId = nodeId;
			let label = initialLabel;
			const visited = new Set([nodeId]);

			while (true) {
				const successors = getSuccessors(currentId);
				if (successors.length === 0) return null; // Dead end

				const nextId = successors[0]; // Assume linear path for join nodes
				const nextNode = graphState.nodes.find(n => n.id === nextId);

				if (!nextNode) return null;

				if (nextNode.type !== 'join') {
					return { id: nextId, label: label };
				}

				if (visited.has(nextId)) return null; // Cycle detected in dummy nodes
				visited.add(nextId);
				currentId = nextId;
				// Keep original label if present, otherwise ignore intermediate labels
			}
		}

		graphState.nodes.forEach(node => {
			if (node.type === 'join') return; // Skip dummy nodes

			let label = node.text.replace(/"/g, "'");
			if (node.type === 'start') code += `${node.id}([Start])\n`;
			else if (node.type === 'end') code += `${node.id}([End])\n`;
			else if (node.type === 'if_else') code += `${node.id}{"${label}"}\n`;
			else if (['for_loop', 'while_loop', 'repeat_loop'].includes(node.type)) code += `${node.id}(("${label}"))\n`;
			else code += `${node.id}["${label}"]\n`;
		});

		graphState.nodes.forEach(node => {
			if (node.type === 'join') return;

			const successors = getSuccessors(node.id);
			successors.forEach(succId => {
				const edgeLabel = getEdgeLabel(node.id, succId);
				const succNode = graphState.nodes.find(n => n.id === succId);

				if (succNode && succNode.type === 'join') {
					const resolved = resolveSuccessor(succId, edgeLabel);
					if (resolved) {
						if (resolved.label) code += `${node.id} -->|${resolved.label}| ${resolved.id}\n`;
						else code += `${node.id} --> ${resolved.id}\n`;
					}
				} else {
					if (edgeLabel) code += `${node.id} -->|${edgeLabel}| ${succId}\n`;
					else code += `${node.id} --> ${succId}\n`;
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

			if (successors.length === 2) {
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
						children: bodyBlocks,
						exitId: exitId // Store exit node ID
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
	contextMenu.innerHTML = '<div class="menu-item" style="cursor: pointer; padding: 5px 10px;">Delete Block</div>';
	document.body.appendChild(contextMenu);

	let currentBlockId = null;

	document.addEventListener('contextmenu', (e) => {
		const block = e.target.closest('.nsd-block');
		if (block) {
			e.preventDefault();
			currentBlockId = block.dataset.id;
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

	contextMenu.querySelector('.menu-item').addEventListener('click', () => {
		if (currentBlockId) {
			deleteBlock(currentBlockId);
			contextMenu.style.display = 'none';
		}
	});

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
		if (['if_else', 'for_loop', 'while_loop', 'repeat_loop'].includes(node.type)) {
			// We need to find all nodes "owned" by this block.
			// This is tricky in a flat graph.
			// Heuristic: Delete immediate dummies and their successors until we hit the exit/merge node.
			// Better: Just delete the main block and heal In -> Exit.
			// But we need to find the Exit/Merge node to connect to.

			// For If/Else: Exit is the Merge node.
			// For Loops: Exit is the node labeled "Exit".

			let exitId = null;
			const successors = getSuccessors(id);

			if (node.type === 'if_else') {
				// Find merge node
				if (successors.length >= 2) {
					exitId = findMergeNode(successors[0], successors[1], id);
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
				if (exitSuccessors.length > 0) {
					// We assume 1 successor for the block as a whole
					const finalSuccessor = exitSuccessors[0];

					// Add Exit node to deletion list
					nodesToDelete.push(exitId);

					// Update outEdges to point to finalSuccessor
					// We fake it so the healing logic below works
					outEdges.length = 0; // Clear
					outEdges.push({ from: id, to: finalSuccessor }); // Fake edge
				}
			}
		}

		// 2. Remove nodes and connected edges
		nodesToDelete.forEach(nid => {
			const idx = graphState.nodes.findIndex(n => n.id === nid);
			if (idx !== -1) graphState.nodes.splice(idx, 1);

			// Remove edges connected to deleted nodes
			// BUT keep the "in" edges of the main node temporarily to know where to connect from
			// and "out" edges of the exit node.
			// Actually, simpler:
			// Just remove ALL edges involving these nodes.
			// We already stored `inEdges` (to the main node) and `outEdges` (faked to be from main to final successor).

			for (let i = graphState.edges.length - 1; i >= 0; i--) {
				const e = graphState.edges[i];
				if (e.from === nid || e.to === nid) {
					graphState.edges.splice(i, 1);
				}
			}
		});

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
		}

		renderDiagram();
	}

	renderDiagram();
});
