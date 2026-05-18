'use strict';

/**
 * Renderer – Rendert den Struktogramm-Baum (TreeState) als DOM-Elemente.
 *
 * Kernmethode: renderInto(container)
 *   Leert den Container und baut das NSD-DOM neu auf.
 *
 * Callbacks (werden von StructogramEditor gesetzt):
 *   onAfterRender()            – wird 100 ms nach dem Rendering aufgerufen
 *   onEditSubprogram(nodeId)   – wird aufgerufen wenn der Edit-Button eines
 *                                Subprogram-Blocks geklickt wird
 */
export class Renderer {
	/**
	 * @param {import('./TreeState.js').TreeState} treeState
	 */
	constructor(treeState) {
		this.treeState         = treeState;
		this.lastContainer     = null;
		this.onAfterRender     = null;
		this.onEditSubprogram  = null;
		this.onNodeTextChanged = null;
	}

	/** Rendert this.treeState in den angegebenen Container. */
	renderInto(container) {
		if (!container) return;
		this.lastContainer = container;

		try {
			container.innerHTML = '';
			const nsdContainer = document.createElement('div');
			nsdContainer.className = 'nsd-container';
			this._renderSeq(this.treeState.root, nsdContainer, null, null);
			container.appendChild(nsdContainer);
		} catch (e) {
			console.error(e);
			container.innerHTML = `<div style="color:red;padding:20px;">Fehler: ${e.message}<br><pre>${e.stack}</pre></div>`;
		}

		setTimeout(() => {
			if (this.onAfterRender) this.onAfterRender();
		}, 100);
	}

	// ── Sequenz & Drop-Zonen ──────────────────────────────────

	_renderSeq(seq, parentEl, containerId, branchIndex) {
		parentEl.appendChild(this._dropZone(containerId, branchIndex, 0, seq.length === 0));
		seq.forEach((node, idx) => {
			parentEl.appendChild(this._renderNode(node));
			parentEl.appendChild(this._dropZone(containerId, branchIndex, idx + 1, false));
		});
	}

	_dropZone(containerId, branchIndex, insertIndex, isEmpty) {
		const z = document.createElement('div');
		z.className = 'insertion-drop-zone';
		if (isEmpty) z.classList.add(containerId === null ? 'initial-zone' : 'empty-container-zone');
		z.dataset.containerId  = containerId  !== null ? containerId  : '__root__';
		z.dataset.branchIndex  = branchIndex  !== null ? String(branchIndex)  : '__none__';
		z.dataset.insertIndex  = String(insertIndex);
		return z;
	}

	decodeDropZone(zone) {
		return {
			containerId:  zone.dataset.containerId === '__root__' ? null : zone.dataset.containerId,
			branchIndex:  zone.dataset.branchIndex === '__none__' ? null : parseInt(zone.dataset.branchIndex, 10),
			insertIndex:  parseInt(zone.dataset.insertIndex, 10)
		};
	}

	// ── Knotenrendering ───────────────────────────────────────

	_renderNode(node) {
		const el  = document.createElement('div');
		let   cls = `nsd-block block-${node.type}`;
		if (['for_loop', 'while_loop', 'repeat_loop'].includes(node.type)) cls += ' block-loop';
		else if (node.type === 'if_else') cls += ' block-if';
		el.className = cls;
		el.dataset.id = node.id;

		if (node.type === 'subprogram') {
			this._renderSubprogram(node, el);
		} else if (['command', 'exit', 'process'].includes(node.type)) {
			el.textContent = node.text;
			this._editable(el, node);
		} else if (node.type === 'if_else') {
			this._renderIfElse(node, el);
		} else if (['for_loop', 'while_loop', 'repeat_loop'].includes(node.type)) {
			this._renderLoop(node, el);
		} else if (node.type === 'case') {
			this._renderCase(node, el);
		} else {
			el.textContent = node.text;
			this._editable(el, node);
		}
		return el;
	}

	_renderSubprogram(node, el) {
		const textSpan = document.createElement('span');
		textSpan.className = 'subprogram-text';
		textSpan.textContent = node.text;
		this._editable(textSpan, node);
		el.appendChild(textSpan);

		if (this.onEditSubprogram) {
			const btn = document.createElement('button');
			btn.className = 'subprogram-edit-btn';
			btn.textContent = '✏ Bearbeiten';
			btn.addEventListener('click', e => {
				e.stopPropagation();
				this.onEditSubprogram(node.id);
			});
			el.appendChild(btn);
		}
	}

	_renderIfElse(node, el) {
		const header = document.createElement('div');
		header.className = 'block-if-header';

		const weights   = (node.branches || []).map(b => Math.max(1, this._countNodes(b.children || [])));
		const totalW    = weights.reduce((a, b) => a + b, 0);
		const splitPct  = (weights[0] / totalW) * 100;

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('class', 'if-svg');
		svg.setAttribute('viewBox', '0 0 100 100');
		svg.setAttribute('preserveAspectRatio', 'none');
		[`0,0,${splitPct},100`, `100,0,${splitPct},100`].forEach(pts => {
			const [x1, y1, x2, y2] = pts.split(',');
			const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			l.setAttribute('x1', x1); l.setAttribute('y1', y1);
			l.setAttribute('x2', x2); l.setAttribute('y2', y2);
			l.setAttribute('stroke', 'black'); l.setAttribute('stroke-width', '1');
			svg.appendChild(l);
		});
		header.appendChild(svg);

		const tc = document.createElement('div');
		tc.className = 'if-condition-text';
		tc.textContent = node.text;
		this._editable(tc, node);
		header.appendChild(tc);
		el.appendChild(header);

		const body = document.createElement('div');
		body.className = 'block-if-body';
		(node.branches || []).forEach((branch, idx) => {
			const bEl = document.createElement('div');
			bEl.className = 'block-if-branch';
			bEl.style.flex = `${weights[idx]} 0 auto`;
			const lbl = document.createElement('div');
			lbl.className = 'if-branch-label';
			lbl.textContent = branch.label;
			bEl.appendChild(lbl);
			this._renderSeq(branch.children, bEl, node.id, idx);
			body.appendChild(bEl);
		});
		el.appendChild(body);
		setTimeout(() => this.observeIfResize(el, header, body), 0);
	}

	_countNodes(seq) {
		let count = 0;
		for (const node of seq) {
			count++;
			if (node.children) count += this._countNodes(node.children);
			if (node.branches) node.branches.forEach(b => { count += this._countNodes(b.children || []); });
		}
		return count;
	}

	_renderLoop(node, el) {
		const isFoot = node.type === 'repeat_loop';
		const header = document.createElement('div');
		header.className = 'block-loop-header';
		header.textContent = node.text;
		this._editable(header, node);

		const body    = document.createElement('div'); body.className = 'block-loop-body';
		const spacer  = document.createElement('div'); spacer.className = 'loop-spacer'; body.appendChild(spacer);
		const content = document.createElement('div'); content.className = 'loop-content';
		this._renderSeq(node.children || [], content, node.id, null);
		body.appendChild(content);

		if (isFoot) { el.appendChild(body); el.appendChild(header); }
		else        { el.appendChild(header); el.appendChild(body); }
	}

	_renderCase(node, el) {
		const header = document.createElement('div');
		header.className = 'block-case-header';
		header.style.position = 'relative';

		const tc = document.createElement('div');
		tc.style.cssText = 'position:absolute;top:5px;width:100%;text-align:center;z-index:5';
		tc.textContent = node.text;
		this._editable(tc, node);
		header.appendChild(tc);

		const nb   = node.branches ? node.branches.length : 0;
		const svg  = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('class', 'case-svg');
		svg.setAttribute('viewBox', '0 0 100 100');
		svg.setAttribute('preserveAspectRatio', 'none');
		header.appendChild(svg);
		const segW   = 100 / nb;
		const splitY = 60;

		(node.branches || []).forEach((branch, idx) => {
			const ld = document.createElement('div');
			ld.className = 'case-header-label';
			ld.dataset.index = idx;
			ld.style.cssText = `position:absolute;top:${splitY}%;left:${idx * segW}%;width:${segW}%;height:${100 - splitY}%;text-align:center;display:flex;align-items:center;justify-content:center;z-index:5`;
			ld.textContent = branch.label;
			ld.contentEditable = true;
			ld.addEventListener('blur',  e => { branch.label = e.target.textContent; });
			ld.addEventListener('click', e => e.stopPropagation());
			header.appendChild(ld);
		});

		const mkLine = (x1, y1, x2, y2, sep) => {
			const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			l.setAttribute('x1', x1); l.setAttribute('y1', y1);
			l.setAttribute('x2', x2); l.setAttribute('y2', y2);
			l.setAttribute('stroke', 'black'); l.setAttribute('stroke-width', '1');
			if (sep !== undefined) l.setAttribute('data-sep-index', sep);
			svg.appendChild(l);
		};
		mkLine('0', '0', segW + '%', splitY + '%');
		mkLine('100', '0', (100 - segW) + '%', splitY + '%');
		if (nb > 2) {
			mkLine(segW + '%', splitY + '%', (100 - segW) + '%', splitY + '%');
			for (let i = 1; i < nb - 1; i++) mkLine((i + 1) * segW + '%', splitY + '%', (i + 1) * segW + '%', '100%', i);
		}
		el.appendChild(header);

		const body = document.createElement('div');
		body.className = 'block-case-body';
		(node.branches || []).forEach((branch, idx) => {
			const bEl = document.createElement('div');
			bEl.className = 'block-case-branch';
			bEl.dataset.caseId = node.id + '_branch_' + idx;
			this._renderSeq(branch.children, bEl, node.id, idx);
			body.appendChild(bEl);
		});
		el.appendChild(body);
		setTimeout(() => this.observeCaseResize(el, header, body), 50);
	}

	_editable(element, node) {
		element.contentEditable = true;
		element.spellcheck = false;
		element.addEventListener('blur', e => {
			node.text = e.target.textContent;
			if (this.onNodeTextChanged) this.onNodeTextChanged(node);
			if (this.onAfterRender) this.onAfterRender();
		});
		element.addEventListener('click', e => e.stopPropagation());
	}

	// ── Resize-Observer Hilfsmethoden ─────────────────────────

	observeIfResize(container, header, body) {
		const svg = header.querySelector('.if-svg');
		if (!svg) return;
		const update = () => {
			const tw = body.offsetWidth;
			if (!tw) return;
			const branches = Array.from(body.children).filter(c => c.classList.contains('block-if-branch'));
			if (branches.length !== 2) return;
			const cp    = (branches[0].offsetWidth / tw) * 100;
			const lines = Array.from(svg.querySelectorAll('line'));
			const lL    = lines.find(l => l.getAttribute('x1') === '0'   && l.getAttribute('y1') === '0');
			const lR    = lines.find(l => l.getAttribute('x1') === '100' && l.getAttribute('y1') === '0');
			if (lL) lL.setAttribute('x2', cp);
			if (lR) lR.setAttribute('x2', cp);
			const tc = header.querySelector('.if-condition-text');
			if (tc) tc.style.left = (50 + (cp - 50) * 0.2) + '%';
		};
		const obs = new ResizeObserver(update);
		obs.observe(body);
		obs.observe(header);
		body.querySelectorAll('.block-if-branch').forEach(b => obs.observe(b));
		setTimeout(update, 50);
	}

	observeCaseResize(container, header, body) {
		const svg = header.querySelector('.case-svg');
		if (!svg) return;
		const update = () => {
			const tw = body.offsetWidth;
			if (!tw) return;
			const branches = Array.from(body.querySelectorAll('.block-case-branch'));
			let   cx = 0;
			const splitY = 60;
			branches.forEach((b, i) => {
				cx += b.offsetWidth;
				if (i < branches.length - 1) {
					const p = (cx / tw) * 100;
					const l = svg.querySelector(`line[data-sep-index="${i + 1}"]`);
					if (l) { l.setAttribute('x1', p + '%'); l.setAttribute('x2', p + '%'); }
				}
				const ld = header.querySelector(`.case-header-label[data-index="${i}"]`);
				if (ld) { ld.style.left = ((cx - b.offsetWidth) / tw * 100) + '%'; ld.style.width = (b.offsetWidth / tw * 100) + '%'; }
			});
			if (branches.length >= 2) {
				const p0 = (branches[0].offsetWidth / tw) * 100;
				const pL = 100 - (branches[branches.length - 1].offsetWidth / tw) * 100;
				const dL = svg.querySelector('line[x1="0"][y1="0"]');
				const dR = svg.querySelector('line[x1="100"][y1="0"]');
				if (dL) dL.setAttribute('x2', p0 + '%');
				if (dR) dR.setAttribute('x2', pL + '%');
				const lines = Array.from(svg.querySelectorAll('line'));
				const h = lines.find(l => !l.hasAttribute('data-sep-index') && l.getAttribute('y1') !== '0' && l.getAttribute('x1') !== l.getAttribute('x2'));
				if (h) { h.setAttribute('x1', p0 + '%'); h.setAttribute('x2', pL + '%'); }
			}
		};
		new ResizeObserver(update).observe(body);
		setTimeout(update, 50);
	}

	updateAllIfElseBlocks() {
		document.querySelectorAll('.block-if').forEach(el => {
			const header  = el.querySelector('.block-if-header');
			const body    = el.querySelector('.block-if-body');
			if (!header || !body) return;
			const svg = header.querySelector('.if-svg');
			if (!svg) return;
			const tw = body.offsetWidth;
			if (!tw) return;
			const branches = Array.from(body.children).filter(c => c.classList.contains('block-if-branch'));
			if (branches.length !== 2) return;
			const cp    = (branches[0].offsetWidth / tw) * 100;
			const lines = Array.from(svg.querySelectorAll('line'));
			const lL    = lines.find(l => l.getAttribute('x1') === '0'   && l.getAttribute('y1') === '0');
			const lR    = lines.find(l => l.getAttribute('x1') === '100' && l.getAttribute('y1') === '0');
			if (lL) lL.setAttribute('x2', cp);
			if (lR) lR.setAttribute('x2', cp);
		});
	}
}
