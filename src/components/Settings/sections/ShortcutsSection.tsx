const SHORTCUTS = [
  { label: 'Paleta de comandos', keys: ['⌘', 'K'], desc: 'Acciones rápidas, ajustes, modelos' },
  { label: 'Búsqueda avanzada', keys: ['⌘', 'F'], desc: 'Busca en títulos y mensajes' },
  { label: 'Barra lateral', keys: ['⌘', 'B'], desc: 'Muestra u oculta el historial' },
  { label: 'Enfocar compositor', keys: ['/'], desc: 'Lleva el foco al cuadro de mensaje' },
  { label: 'Cerrar ajustes', keys: ['Esc'], desc: 'Vuelve al chat activo' },
];

export default function ShortcutsSection() {
  return (
    <div className="cfg-page">
      <div className="cfg-page-header">
        <h2 className="cfg-page-title">Atajos de teclado</h2>
        <p className="cfg-page-desc">Referencia rápida de combinaciones disponibles en la app.</p>
      </div>

      <div className="cfg-section">
        {SHORTCUTS.map((shortcut, index) => (
          <div
            key={shortcut.label}
            className={`cfg-row ${index < SHORTCUTS.length - 1 ? 'cfg-row--border' : ''}`}
          >
            <div className="cfg-row-info">
              <span className="cfg-row-label">{shortcut.label}</span>
              <span className="cfg-row-hint">{shortcut.desc}</span>
            </div>
            <div className="cfg-keys">
              {shortcut.keys.map((key) => (
                <kbd key={key} className="cfg-kbd">
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
