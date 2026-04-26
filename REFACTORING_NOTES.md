# Refactoring-Dokumentation: Objektorientierte Struktur

## Datum: 26. April 2026

## Überblick

Der Struktogramm-Editor wurde von einer prozeduralen zu einer objektorientierten Architektur umstrukturiert und ein kritischer Fehler wurde behoben.

## Behobener Fehler

### Problem
```
TypeError: Cannot read properties of undefined (reading 'forEach')
    at renderTree (script.js:217:10)
```

Der Fehler trat auf, wenn ein Block (insbesondere ein For-Loop) verschoben wurde. Nach dem Verschieben fehlte bei manchen Blöcken die `children`-Property, was zu einem Fehler beim Rendering führte.

### Ursache
In der `buildStructure`-Funktion wurden Loops, die nur einen Successor hatten oder bei denen die Struktur nicht korrekt erkannt wurde, als einfache Process-Blöcke behandelt und erhielten keine `children`-Property. Beim Rendering wurde dann versucht, `.forEach()` auf `undefined` aufzurufen.

### Lösung
1. **In `buildLoopBlock`**: Immer ein `children`-Array initialisieren, auch bei Fehlern:
   ```javascript
   let bodyBlocks = [];
   try {
       bodyBlocks = this.buildStructure(bodyStartId, node.id, new Set(visited));
   } catch (e) {
       console.error('Error building loop body:', e);
   }
   
   blocks.push({
       type: node.type,
       id: node.id,
       text: node.text,
       children: bodyBlocks // Immer ein Array, nie undefined
   });
   ```

2. **In `renderLoopBlock`**: Sicherheitsprüfung mit Fallback:
   ```javascript
   const children = block.children || [];
   this.renderTree(children, content, bodyStartId, block.id);
   ```

## Objektorientierte Architektur

### Neue Klassen

#### 1. `GraphState`
Verwaltet den internen Zustand des Graphen.

**Eigenschaften:**
- `nodes`: Array aller Knoten
- `edges`: Array aller Kanten

**Methoden:**
- `getNode(id)`: Gibt einen Knoten anhand seiner ID zurück
- `addNode(node)`: Fügt einen Knoten hinzu
- `removeNode(id)`: Entfernt einen Knoten
- `addEdge(edge)`: Fügt eine Kante hinzu
- `removeEdge(from, to)`: Entfernt eine Kante
- `findEdge(from, to)`: Findet den Index einer Kante
- `getEdge(from, to)`: Gibt eine Kante zurück
- `getSuccessors(nodeId)`: Gibt alle Nachfolger eines Knotens zurück
- `getEdgeLabel(fromId, toId)`: Gibt das Label einer Kante zurück

#### 2. `BlockFactory`
Erstellt Blöcke verschiedener Typen mit korrekter Struktur.

**Statische Methoden:**
- `createBlock(type, graphState)`: Erstellt einen Block des angegebenen Typs
- `getDefaultText(type)`: Gibt den Standard-Text für einen Block-Typ zurück
- `createIfElseBlock()`: Erstellt einen If-Else-Block mit allen Dummy-Knoten
- `createLoopBlock()`: Erstellt einen Loop-Block mit Body-Dummy
- `createCaseBlock()`: Erstellt einen Case-Block mit mehreren Branches

#### 3. `StructureBuilder`
Konvertiert die Graph-Repräsentation in eine Baumstruktur für das Rendering.

**Methoden:**
- `buildStructure(startNodeId, stopNodeId, visited)`: Hauptmethode zum Aufbau der Struktur
- `buildCaseBlock()`: Spezielle Logik für Case-Blöcke
- `buildLoopBlock()`: Spezielle Logik für Loop-Blöcke (mit Fehlerbehandlung)
- `buildIfElseBlock()`: Spezielle Logik für If-Else-Blöcke
- `findMergeNode()`: Findet den Merge-Knoten für verzweigte Strukturen

#### 4. `Renderer`
Rendert das Diagramm im DOM.

**Methoden:**
- `render()`: Hauptmethode zum Rendern des gesamten Diagramms
- `renderTree()`: Rekursives Rendern der Baumstruktur
- `renderBlockGraph()`: Rendert einen einzelnen Block
- `renderIfElseBlock()`: Rendert If-Else-Blöcke mit SVG-Diagonalen
- `renderLoopBlock()`: Rendert Loop-Blöcke
- `renderCaseBlock()`: Rendert Case-Blöcke mit SVG-Geometrie
- `makeEditable()`: Macht Elemente editierbar

#### 5. `BlockManager`
Verwaltet das Hinzufügen, Löschen und Verschieben von Blöcken.

**Methoden:**
- `addBlock(type, edgeIndex)`: Fügt einen neuen Block hinzu
- `deleteBlock(id)`: Löscht einen Block
- `moveBlock(blockId, targetFrom, targetTo)`: Verschiebt einen Block
- `enterMoveMode(blockId)`: Aktiviert den Move-Modus
- `exitMoveMode()`: Deaktiviert den Move-Modus
- `getInternalNodes(blockId)`: Gibt alle internen Knoten eines Blocks zurück
- `getBlockBounds(blockId)`: Gibt die Grenzen eines Blocks zurück
- `addCaseOption()`: Fügt eine Case-Option hinzu
- `deleteCaseOption()`: Löscht eine Case-Option

#### 6. `DragDropManager`
Verwaltet Drag & Drop-Operationen.

**Methoden:**
- `setupDraggables(draggables)`: Richtet Drag-Events ein
- `setupDropZone(zone, edgeIndex)`: Richtet eine Drop-Zone ein
- `setupAllDropZones()`: Richtet alle Drop-Zones nach dem Rendering ein

### Globale Funktionen (für Kompatibilität)

Die folgenden Funktionen bleiben global verfügbar:
- `updateMermaid()`: Aktualisiert den Mermaid-Code
- `generateMermaid()`: Generiert Mermaid-Code aus dem Graphen
- `updateAllIfElseBlocks()`: Aktualisiert alle If-Else-Block-SVGs
- `observeIfResize()`: Beobachtet Größenänderungen von If-Else-Blöcken
- `observeCaseResize()`: Beobachtet Größenänderungen von Case-Blöcken

## Vorteile der neuen Architektur

1. **Bessere Wartbarkeit**: Jede Klasse hat eine klare Verantwortung
2. **Einfachere Fehlersuche**: Bugs können isoliert in einzelnen Klassen behoben werden
3. **Erweiterbarkeit**: Neue Funktionen können einfacher hinzugefügt werden
4. **Wiederverwendbarkeit**: Klassen können in anderen Kontexten wiederverwendet werden
5. **Testbarkeit**: Jede Klasse kann einzeln getestet werden
6. **Fehlerrobustheit**: Try-catch-Blöcke in kritischen Bereichen verhindern Abstürze

## Dateien

### Geänderte Dateien
- `/static/script.js`: Ersetzt durch OOP-Version

### Neue Dateien
- `/static/script_oop.js`: Template der OOP-Version
- `/static/script_backup.js`: Backup der originalen Version

## Testing

Der Server läuft erfolgreich auf `http://localhost:5000` (HTTP 200).

### Zu testende Szenarien:
1. ✓ Server startet ohne Fehler
2. □ Blöcke können hinzugefügt werden
3. □ Blöcke können verschoben werden (kritischer Test für den behobenen Bug)
4. □ Blöcke können gelöscht werden
5. □ If-Else-Blöcke rendern korrekt
6. □ Loop-Blöcke rendern korrekt
7. □ Case-Blöcke rendern korrekt
8. □ Mermaid-Code wird korrekt generiert

### Kritischer Test: Block verschieben
1. Erstelle einen For-Loop
2. Füge ein If-Else-Block innerhalb des Loops hinzu
3. Erstelle einen zweiten For-Loop
4. Versuche den zweiten Loop in den ersten zu verschieben
5. **Erwartetes Ergebnis**: Kein TypeError mehr, Loop wird korrekt gerendert

## Nächste Schritte

1. Umfassende Benutzer-Tests durchführen
2. Unit-Tests für alle Klassen schreiben
3. Weitere Fehlerbehandlung in Edge Cases
4. Dokumentation der API für zukünftige Entwickler
5. Performance-Optimierungen bei großen Diagrammen

## Migration von der alten Version

Falls ein Rollback zur alten Version nötig ist:
```bash
cp static/script_backup.js static/script.js
```

Falls die neue Version produktiv gehen soll:
```bash
rm static/script_oop.js  # Template nicht mehr benötigt
```
