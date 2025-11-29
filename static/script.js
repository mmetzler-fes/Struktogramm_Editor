document.addEventListener('DOMContentLoaded', () => {
	const draggables = document.querySelectorAll('.draggable-item');
	const canvas = document.getElementById('canvas');
	let diagramData = []; // Root level blocks

	// Drag Start
	draggables.forEach(draggable => {
		draggable.addEventListener('dragstart', (e) => {
			e.dataTransfer.setData('type', draggable.dataset.type);
			e.dataTransfer.effectAllowed = 'copy';
		});
	});

	// Initial Drop Zone
	const initialZone = document.querySelector('.initial-zone');
	setupDropZone(initialZone, (type) => {
		addBlock(diagramData, type);
	});

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

	function addBlock(parentArray, type, index = null) {
		const newBlock = createBlockData(type);
		if (index !== null) {
			parentArray.splice(index, 0, newBlock);
		} else {
			parentArray.push(newBlock);
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

	function renderDiagram() {
		canvas.innerHTML = '';

		if (diagramData.length === 0) {
			const emptyZone = document.createElement('div');
			emptyZone.className = 'drop-zone initial-zone';
			emptyZone.innerHTML = '<p>Drag blocks here to start</p>';
			setupDropZone(emptyZone, (type) => addBlock(diagramData, type));
			canvas.appendChild(emptyZone);
		} else {
			const container = document.createElement('div');
			container.className = 'nsd-container';

			// Render blocks with drop zones in between
			diagramData.forEach((block, index) => {
				// Drop zone before block (only needed if we want insertion, for now append only is easier for MVP, 
				// but let's try to add insertion points)
				// For simplicity in this iteration, we'll just render the list. 
				// A more advanced version would have drop zones between every block.
				container.appendChild(renderBlock(block, diagramData, index));
			});

			// Drop zone at the end of the root container
			const endZone = createNestedDropZone((type) => addBlock(diagramData, type));
			container.appendChild(endZone);

			canvas.appendChild(container);
		}
		updateMermaid();
	}

	function createNestedDropZone(onDrop) {
		const zone = document.createElement('div');
		zone.className = 'nested-drop-zone';
		setupDropZone(zone, onDrop);
		return zone;
	}

	function renderBlock(block, parentArray, index) {
		const el = document.createElement('div');
		el.className = `nsd-block block-${block.type}`;
		el.dataset.id = block.id;

		// Content Editable Logic
		const makeEditable = (element, obj, key = 'text') => {
			element.contentEditable = true;
			element.addEventListener('blur', (e) => {
				obj[key] = e.target.textContent;
				updateMermaid();
			});
			element.addEventListener('click', (e) => e.stopPropagation()); // Prevent drag start interference if any
		};

		if (block.type === 'command' || block.type === 'exit' || block.type === 'subprogram') {
			el.textContent = block.text;
			makeEditable(el, block);
		}
		else if (block.type === 'if_else') {
			const header = document.createElement('div');
			header.className = 'block-if-header';

			// SVG Background - V Shape
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("class", "if-svg");
			svg.setAttribute("viewBox", "0 0 100 100");
			svg.setAttribute("preserveAspectRatio", "none");
			svg.innerHTML = `
                <line x1="0" y1="0" x2="50" y2="100" stroke="black" stroke-width="1" />
                <line x1="100" y1="0" x2="50" y2="100" stroke="black" stroke-width="1" />
            `;
			header.appendChild(svg);

			// Text Overlay (Condition)
			const textContainer = document.createElement('div');
			textContainer.style.position = 'absolute';
			textContainer.style.top = '10px';
			textContainer.style.width = '100%';
			textContainer.style.textAlign = 'center';
			textContainer.textContent = block.text;
			makeEditable(textContainer, block);
			header.appendChild(textContainer);

			// True/False Labels (Ja/Nein)
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

				// Update branch label in data if needed (optional, but good for consistency)
				if (index === 0) branch.label = 'Ja';
				if (index === 1) branch.label = 'Nein';

				// Render children of branch
				branch.children.forEach((child, childIndex) => {
					branchEl.appendChild(renderBlock(child, branch.children, childIndex));
				});

				// Drop zone for branch
				const branchZone = createNestedDropZone((type) => addBlock(branch.children, type));
				branchEl.appendChild(branchZone);

				body.appendChild(branchEl);
			});

			el.appendChild(body);
		}
		else if (['for_loop', 'while_loop', 'repeat_loop'].includes(block.type)) {
			const isFootControlled = block.type === 'repeat_loop';

			const header = document.createElement('div');
			header.className = 'block-loop-header';
			header.textContent = block.text;
			makeEditable(header, block);

			const body = document.createElement('div');
			body.className = 'block-loop-body';

			// Spacer (Left Column)
			const spacer = document.createElement('div');
			spacer.className = 'loop-spacer';
			body.appendChild(spacer);

			// Content Container
			const content = document.createElement('div');
			content.className = 'loop-content';

			block.children.forEach((child, childIndex) => {
				content.appendChild(renderBlock(child, block.children, childIndex));
			});

			const loopZone = createNestedDropZone((type) => addBlock(block.children, type));
			content.appendChild(loopZone);

			body.appendChild(content);

			if (isFootControlled) {
				el.appendChild(body);
				el.appendChild(header); // Header (condition) at bottom for foot-controlled
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
			body: JSON.stringify(diagramData),
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
		const mermaidCode = generateMermaid(diagramData);
		navigator.clipboard.writeText(mermaidCode).then(() => {
			alert('Mermaid code copied to clipboard!');
		});
	});

	function updateMermaid() {
		const mermaidCode = generateMermaid(diagramData);
		document.getElementById('mermaid-output').textContent = mermaidCode;
	}

	function generateMermaid(data) {
		let code = 'flowchart TD\n';
		let nodeIdCounter = 0;

		// Helper to get a unique ID
		const getNextId = () => `node${nodeIdCounter++}`;

		// Let's try a pure graph approach which is standard for Flowcharts
		// We will link nodes sequentially.

		function buildGraph(nodes, entryId) {
			let lastId = entryId;
			let graphCode = '';

			nodes.forEach(node => {
				const id = getNextId();
				const label = node.text.replace(/"/g, "'");

				if (lastId && lastId !== 'start') { // Don't link 'start' to the first node if it's the entry
					graphCode += `${lastId} --> ${id}\n`;
				}

				if (node.type === 'if_else') {
					graphCode += `${id}{"${label}"}\n`;

					// True Path
					const trueStartId = getNextId();
					graphCode += `${id} -- True --> ${trueStartId}[ ]\n`; // Dummy start for alignment
					const { code: trueCode, endId: trueEnd } = buildGraph(node.branches[0].children, trueStartId);
					graphCode += trueCode;

					// False Path
					const falseStartId = getNextId();
					graphCode += `${id} -- False --> ${falseStartId}[ ]\n`;
					const { code: falseCode, endId: falseEnd } = buildGraph(node.branches[1].children, falseStartId);
					graphCode += falseCode;

					// Merge point
					const mergeId = getNextId();
					graphCode += `${mergeId}[End If]\n`;
					if (trueEnd) graphCode += `${trueEnd} --> ${mergeId}\n`;
					else graphCode += `${trueStartId} --> ${mergeId}\n`; // Empty branch

					if (falseEnd) graphCode += `${falseEnd} --> ${mergeId}\n`;
					else graphCode += `${falseStartId} --> ${mergeId}\n`;

					lastId = mergeId;

				} else if (['for_loop', 'while_loop', 'repeat_loop'].includes(node.type)) {
					graphCode += `${id}(("${label}"))\n`;

					// Loop Body
					const loopBodyEntryId = getNextId();
					graphCode += `${id} --> ${loopBodyEntryId}[ ]\n`; // Link loop head to body entry
					const { code: bodyCode, endId: bodyEnd } = buildGraph(node.children, loopBodyEntryId);
					graphCode += bodyCode;

					// Loop back
					if (bodyEnd) graphCode += `${bodyEnd} --> ${id}\n`;
					else graphCode += `${loopBodyEntryId} --> ${id}\n`; // Empty loop body loops back from its entry

					// Exit loop
					const loopExitId = getNextId();
					graphCode += `${id} -- Exit --> ${loopExitId}[End Loop]\n`;
					lastId = loopExitId;

				} else {
					graphCode += `${id}["${label}"]\n`;
					lastId = id;
				}
			});

			return { code: graphCode, endId: lastId };
		}

		const { code: body } = buildGraph(data, 'start'); // Use 'start' as a dummy entry point
		return code + body;
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
		// Recursive function to find and remove block
		function removeRecursive(nodes) {
			const index = nodes.findIndex(n => n.id === id);
			if (index !== -1) {
				nodes.splice(index, 1);
				return true;
			}
			for (const node of nodes) {
				if (node.children && removeRecursive(node.children)) return true;
				if (node.branches) {
					for (const branch of node.branches) {
						if (removeRecursive(branch.children)) return true;
					}
				}
			}
			return false;
		}

		removeRecursive(diagramData);
		renderDiagram();
	}
});
