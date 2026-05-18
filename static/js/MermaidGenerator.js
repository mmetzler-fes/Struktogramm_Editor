'use strict';

/**
 * MermaidGenerator – Erzeugt Mermaid-Flowchart-Code aus einem TreeState
 * und aktualisiert das Mermaid-Ausgabe-Element im DOM.
 */
export class MermaidGenerator {
	/**
	 * @param {import('./StructogramEditor.js').StructogramEditor} editor
	 */
	constructor(editor) {
		this.editor = editor;
	}

	/** Aktualisiert das #mermaid-output Element. */
	update() {
		const el = document.getElementById('mermaid-output');
		if (el) el.textContent = this.generate();
	}

	/** Erzeugt Mermaid-Code für das Hauptprogramm. */
	generate() {
		return this._generateFromTreeState(this.editor.mainTreeState);
	}

	/**
	 * Erzeugt Mermaid-Code aus einem beliebigen TreeState.
	 * @param {import('./TreeState.js').TreeState} treeState
	 * @returns {string}
	 */
	_generateFromTreeState(treeState) {
		const { nodes, edges } = treeState.toGraphFormat();

		const nodeMap = {};
		nodes.forEach(n => { nodeMap[n.id] = n; });

		const fwd = {};
		edges.forEach(e => {
			if (!fwd[e.from]) fwd[e.from] = [];
			fwd[e.from].push(e);
		});

		// BFS: erreichbare Knoten sammeln
		const reachable = new Set();
		const q = ['start_node_id'];
		while (q.length) {
			const id = q.shift();
			if (reachable.has(id)) continue;
			reachable.add(id);
			(fwd[id] || []).forEach(e => q.push(e.to));
		}

		let code = 'flowchart TD\n';
		code += 'classDef default fill:#fff,stroke:#000,stroke-width:1px;\n';
		code += 'classDef join fill:#fff,stroke:#000,stroke-width:0px;\n';

		// Knoten
		reachable.forEach(id => {
			const n = nodeMap[id];
			if (!n || n.type === 'join') return;
			const lbl = (n.text || '').replace(/"/g, "'");
			if      (n.type === 'start')                                              code += `${id}([Start])\n`;
			else if (n.type === 'end')                                                code += `${id}([End])\n`;
			else if (n.type === 'if_else' || n.type === 'case')                       code += `${id}{"${lbl}"}\n`;
			else if (['for_loop', 'while_loop', 'repeat_loop'].includes(n.type))      code += `${id}(["${lbl}"])\n`;
			else if (n.type === 'subprogram')                                         code += `${id}[["${lbl}"]]\n`;
			else                                                                       code += `${id}["${lbl}"]\n`;
		});

		// Kanten (Join-Knoten werden aufgelöst)
		const resolveJoin = (id, lbl) => {
			let cur = id;
			const seen = new Set([id]);
			while (true) {
				const s = fwd[cur];
				if (!s || !s.length) return null;
				const next = s[0].to;
				const nn   = nodeMap[next];
				if (!nn) return null;
				if (nn.type !== 'join') return { id: next, label: lbl };
				if (seen.has(next)) return null;
				seen.add(next);
				cur = next;
			}
		};

		reachable.forEach(id => {
			const n = nodeMap[id];
			if (!n || n.type === 'join') return;
			(fwd[id] || []).forEach(e => {
				const sn = nodeMap[e.to];
				if (sn && sn.type === 'join') {
					const r = resolveJoin(e.to, e.label || '');
					if (r) code += `${id} -->${r.label ? '|' + r.label + '|' : ''} ${r.id}\n`;
				} else {
					code += `${id} -->${e.label ? '|' + e.label + '|' : ''} ${e.to}\n`;
				}
			});
		});

		return code;
	}
}
