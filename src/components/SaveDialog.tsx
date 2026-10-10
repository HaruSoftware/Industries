import { useRef } from 'react'
import { RotateCcw } from 'lucide-react'

type SaveDialogProps = {
  saveText: string
  saveMessage: string
  onClose: () => void
  onTextChange: (text: string) => void
  onCopy: () => void
  onDownload: () => void
  onLoadText: () => void
  onReadFile: (file: File | undefined) => void
  onReset: () => void
}

export function SaveDialog({
  saveText,
  saveMessage,
  onClose,
  onTextChange,
  onCopy,
  onDownload,
  onLoadText,
  onReadFile,
  onReset,
}: SaveDialogProps) {
  const saveFileInput = useRef<HTMLInputElement>(null)

  return (
    <div
      className="save-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="save-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-dialog-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
      >
        <div className="save-dialog-heading">
          <div>
            <p className="panel-kicker">SEU PROGRESSO</p>
            <h2 id="save-dialog-title">Salvar ou carregar jogo</h2>
          </div>
          <button
            className="save-dialog-close"
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de save"
          >
            ×
          </button>
        </div>
        <p className="save-dialog-description">
          O jogo salva automaticamente neste navegador. Copie o texto ou
          exporte o JSON para levar seu progresso a outro dispositivo.
        </p>
        <label className="save-text-label" htmlFor="save-text">
          Save em texto (JSON)
        </label>
        <textarea
          id="save-text"
          className="save-textarea"
          value={saveText}
          onChange={(event) => onTextChange(event.target.value)}
          autoFocus
          spellCheck={false}
          rows={12}
        />
        <div className="save-dialog-actions">
          <button
            className="save-action-button save-action-primary"
            type="button"
            onClick={onCopy}
          >
            Copiar texto
          </button>
          <button
            className="save-action-button"
            type="button"
            onClick={onDownload}
          >
            Exportar JSON
          </button>
          <button
            className="save-action-button"
            type="button"
            onClick={onLoadText}
          >
            Carregar texto
          </button>
          <button
            className="save-action-button"
            type="button"
            onClick={() => saveFileInput.current?.click()}
          >
            Abrir arquivo
          </button>
          <button
            className="save-action-button save-action-danger"
            type="button"
            onClick={onReset}
          >
            <RotateCcw aria-hidden="true" size={14} />
            Começar de novo
          </button>
          <input
            ref={saveFileInput}
            className="save-file-input"
            type="file"
            accept="application/json,.json"
            aria-label="Selecionar arquivo de save JSON"
            onChange={(event) => {
              onReadFile(event.currentTarget.files?.[0])
              event.currentTarget.value = ''
            }}
          />
        </div>
        <p className="save-dialog-status" role="status">
          {saveMessage}
        </p>
      </section>
    </div>
  )
}
