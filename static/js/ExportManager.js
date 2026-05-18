'use strict';

import { TreeState } from './TreeState.js';

/**
 * ExportManager – Verwaltet alle Dateioperationen:
 *   - JSON Speichern / Laden
 *   - Mermaid-Code speichern / kopieren
 *   - NSD SVG exportieren (via Backend)
 *   - PAP SVG exportieren (client-seitig via Mermaid.js)
 */
export class ExportManager {
	/**
	 * @param {import('./StructogramEditor.js').StructogramEditor} editor
	 */
	constructor(editor) {
		this.editor = editor;
	}

	// ── JSON ──────────────────────────────────────────────────

	saveJSON() {
		const data = {
			...this.editor.mainTreeState.toGraphFormat(),
			subprograms: this.editor.subprogramManager.toJSON()
		};
		this._download(
			'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2)),
			'struktogramm.json'
		);
	}

	loadJSON(jsonData) {
		if (!jsonData.nodes || !jsonData.edges) throw new Error('Ungültiges Format.');
		const loaded = TreeState.fromGraphFormat(jsonData);
		this.editor.mainTreeState.root = loaded.root;
		this.editor.subprogramManager.fromJSON(jsonData.subprograms || {});
		this.editor.renderDiagram();
	}

	// ── Mermaid ───────────────────────────────────────────────

	saveMermaid() {
		const code = this.editor.mermaidGenerator.generate();
		this._download(
			'data:text/plain;charset=utf-8,' + encodeURIComponent(code),
			'diagram.mmd'
		);
	}

	copyMermaid() {
		const code = this.editor.mermaidGenerator.generate();
		navigator.clipboard.writeText(code)
			.then(() => alert('Mermaid-Code kopiert!'))
			.catch(err => alert('Fehler beim Kopieren: ' + err));
	}

	// ── NSD SVG (Backend) ─────────────────────────────────────

	exportNSD() {
		const modal   = document.getElementById('export-modal');
		const preview = document.getElementById('export-preview');
		document.getElementById('export-title').textContent = 'Struktogramm (NSD)';
		preview.innerHTML = 'Generating...';
		modal.style.display = 'flex';

		// Nur aktive Unterprogramme senden (dedupliziert, mit korrektem Namen)
		const subprograms = {};
		for (const { node, subRef } of this.editor._collectSubprogramNodes(this.editor.mainTreeState.root)) {
			const state = this.editor.subprogramManager.get(subRef);
			if (state) {
				subprograms[subRef] = {
					name:    node.text,
					mermaid: this.editor.mermaidGenerator._generateFromTreeState(state)
				};
			}
		}

		const body = {
			mermaid: this.editor.mermaidGenerator.generate(),
			subprograms
		};

		fetch('/api/convert_nsd', {
			method:  'POST',
			headers: { 'Content-Type': 'application/json' },
			body:    JSON.stringify(body)
		})
			.then(r => r.json())
			.then(d => {
				if (d.svg) this._openExportModal('Struktogramm (NSD)', d.svg, 'struktogramm.svg');
				else preview.innerHTML = 'Fehler: ' + (d.error || '?');
			})
			.catch(err => { preview.innerHTML = 'Fehler: ' + err; });
	}

	// ── PAP SVG (client-seitig) ───────────────────────────────

	async exportPAP() {
		const modal   = document.getElementById('export-modal');
		const preview = document.getElementById('export-preview');
		document.getElementById('export-title').textContent = 'Programmablaufplan (PAP)';
		preview.innerHTML = 'Generating...';
		modal.style.display = 'flex';

		try {
			const mermaidCode = this.editor.mermaidGenerator.generate();
			const { svg }     = await window.mermaid.render('mermaid-pap-' + Date.now(), mermaidCode);
			const processed   = this._postProcessPAP(svg);
			this._openExportModal('Programmablaufplan (PAP)', processed, 'programmablaufplan.svg');
		} catch (err) {
			preview.innerHTML = 'Fehler: ' + err.message;
		}
	}

	_postProcessPAP(svg) {
		const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
		doc.querySelectorAll('.node rect,.node polygon,.node circle,.node ellipse').forEach(el => {
			el.setAttribute('fill', '#ffffff'); el.setAttribute('stroke', '#000000'); el.setAttribute('stroke-width', '1');
		});
		doc.querySelectorAll('.edgePaths path').forEach(el => {
			el.setAttribute('stroke', '#000000'); el.setAttribute('stroke-width', '1'); el.setAttribute('fill', 'none');
		});
		doc.querySelectorAll('marker path').forEach(el => {
			el.setAttribute('fill', '#000000'); el.setAttribute('stroke', '#000000');
		});
		doc.querySelectorAll('.edgeLabel rect').forEach(el => {
			el.setAttribute('fill', '#ffffff'); el.setAttribute('stroke', 'none');
		});
		doc.querySelectorAll('text,tspan').forEach(el => {
			el.setAttribute('fill', '#000000'); el.setAttribute('stroke', 'none');
			el.setAttribute('text-anchor', el.style.textAnchor || 'middle');
		});
		doc.querySelectorAll('foreignObject').forEach(el => el.remove());
		return new XMLSerializer().serializeToString(doc.documentElement);
	}

	// ── Modal ─────────────────────────────────────────────────

	_openExportModal(title, svgContent, filename) {
		document.getElementById('export-title').textContent   = title;
		document.getElementById('export-preview').innerHTML   = svgContent;
		document.getElementById('export-modal').style.display = 'flex';
		document.getElementById('download-export-btn').onclick = () =>
			this._downloadSVG(svgContent, filename);
	}

	// ── Download-Helfer ───────────────────────────────────────

	_download(dataUrl, filename) {
		const a = document.createElement('a');
		a.setAttribute('href', dataUrl);
		a.setAttribute('download', filename);
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	_downloadSVG(svgContent, filename) {
		const url = URL.createObjectURL(new Blob([svgContent], { type: 'image/svg+xml' }));
		const a   = document.createElement('a');
		a.href = url; a.download = filename;
		document.body.appendChild(a); a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
}
